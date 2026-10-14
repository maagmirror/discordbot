'use strict';

// Lee playlists, álbumes y temas de Spotify para buscarlos después en YouTube.
// Spotify no deja bajar audio: de acá solo sale "artista - título" y la duración.
//
// Dos caminos:
//  1. API oficial (SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET): trae la lista
//     completa, paginada.
//  2. Sin credenciales (o si la API falla): la página pública del reproductor
//     embebido, que trae hasta ~100 temas.

const TIMEOUT_MS = 15_000;
const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

let tokenCache = null;

/** open.spotify.com/(intl-xx/)?{playlist|album|track}/ID o spotify:{tipo}:ID */
function parsear(texto) {
	const limpio = String(texto ?? '').trim();

	const uri = limpio.match(/^spotify:(playlist|album|track):([A-Za-z0-9]+)$/);
	if (uri) return { tipo: uri[1], id: uri[2] };

	let url;
	try {
		url = new URL(limpio);
	} catch {
		return null;
	}
	if (!/(^|\.)spotify\.com$/i.test(url.hostname)) return null;

	const partes = url.pathname.split('/').filter(Boolean);
	const i = partes.findIndex((p) => ['playlist', 'album', 'track'].includes(p));
	if (i === -1 || !partes[i + 1]) return null;

	return { tipo: partes[i], id: partes[i + 1] };
}

function esSpotify(texto) {
	return parsear(texto) !== null;
}

async function pedir(url, opciones = {}) {
	const respuesta = await fetch(url, {
		...opciones,
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: { 'User-Agent': UA, ...(opciones.headers ?? {}) },
	});
	if (!respuesta.ok) {
		throw new Error(`Spotify respondió ${respuesta.status}`);
	}
	return respuesta;
}

function hayCredenciales() {
	return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function token() {
	if (tokenCache && tokenCache.vence > Date.now()) return tokenCache.valor;

	const basic = Buffer.from(
		`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
	).toString('base64');

	const respuesta = await pedir('https://accounts.spotify.com/api/token', {
		method: 'POST',
		headers: {
			Authorization: `Basic ${basic}`,
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: 'grant_type=client_credentials',
	});
	const datos = await respuesta.json();

	tokenCache = {
		valor: datos.access_token,
		vence: Date.now() + (datos.expires_in - 60) * 1000,
	};
	return tokenCache.valor;
}

async function api(ruta) {
	const url = ruta.startsWith('http') ? ruta : `https://api.spotify.com/v1${ruta}`;
	const respuesta = await pedir(url, {
		headers: { Authorization: `Bearer ${await token()}` },
	});
	return respuesta.json();
}

function tema(nombre, artistas, duracionMs) {
	const autor = artistas.filter(Boolean).join(', ');
	return {
		titulo: autor ? `${autor} - ${nombre}` : nombre,
		autor: autor || 'desconocido',
		duracion: Number.isFinite(duracionMs) ? Math.round(duracionMs / 1000) : null,
	};
}

async function porApi({ tipo, id }, maximo) {
	if (tipo === 'track') {
		const t = await api(`/tracks/${id}`);
		return {
			nombre: t.name,
			temas: [tema(t.name, t.artists.map((a) => a.name), t.duration_ms)],
			total: 1,
		};
	}

	const cabecera = await api(
		tipo === 'playlist'
			? `/playlists/${id}?fields=name,tracks(total)`
			: `/albums/${id}?fields=name,tracks(total)`,
	);
	const temas = [];
	let siguiente =
		tipo === 'playlist'
			? `/playlists/${id}/tracks?limit=100&fields=next,items(track(name,duration_ms,is_local,artists(name)))`
			: `/albums/${id}/tracks?limit=50`;

	while (siguiente && temas.length < maximo) {
		const pagina = await api(siguiente);
		for (const item of pagina.items ?? []) {
			const t = tipo === 'playlist' ? item.track : item;
			if (!t?.name) continue; // temas borrados / episodios
			temas.push(tema(t.name, (t.artists ?? []).map((a) => a.name), t.duration_ms));
		}
		siguiente = pagina.next;
	}

	return {
		nombre: cabecera.name,
		temas: temas.slice(0, maximo),
		total: cabecera.tracks?.total ?? temas.length,
	};
}

async function porEmbed({ tipo, id }, maximo) {
	const respuesta = await pedir(`https://open.spotify.com/embed/${tipo}/${id}`);
	const html = await respuesta.text();

	const json = html.match(
		/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
	);
	if (!json) throw new Error('no pude leer la página de Spotify');

	const entidad = JSON.parse(json[1])?.props?.pageProps?.state?.data?.entity;
	if (!entidad) throw new Error('Spotify no devolvió datos (¿la lista es privada?)');

	const nombre = entidad.name ?? entidad.title ?? 'Spotify';

	if (tipo === 'track') {
		const artistas = (entidad.artists ?? []).map((a) => a.name);
		return { nombre, temas: [tema(nombre, artistas, entidad.duration)], total: 1 };
	}

	const lista = entidad.trackList ?? [];
	const temas = lista
		.filter((t) => t?.title)
		.map((t) =>
			tema(
				t.title,
				// subtitle = artistas separados por coma (a veces con espacios duros)
				String(t.subtitle ?? '').replace(/ /g, ' ').split(/\s*,\s*/),
				t.duration,
			),
		);

	return { nombre, temas: temas.slice(0, maximo), total: temas.length };
}

/**
 * Devuelve { nombre, temas: [{ titulo, autor, duracion }], total }.
 * `total` puede ser mayor que temas.length si se cortó por `maximo`.
 */
async function obtener(texto, maximo = 500) {
	const ref = parsear(texto);
	if (!ref) throw new Error('ese link de Spotify no lo entiendo');

	if (hayCredenciales()) {
		try {
			return await porApi(ref, maximo);
		} catch (error) {
			console.error('[spotify] API, pruebo con el embed:', error.message);
		}
	}

	return porEmbed(ref, maximo);
}

module.exports = { esSpotify, obtener, hayCredenciales };
