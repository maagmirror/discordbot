'use strict';

const { spawn } = require('node:child_process');
const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	entersState,
	StreamType,
	VoiceConnectionStatus,
	AudioPlayerStatus,
	NoSubscriberBehavior,
	getVoiceConnection,
	demuxProbe,
} = require('@discordjs/voice');
const spotify = require('./spotify');

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

// Prioriza webm/opus: Discord lo transmite tal cual, sin pasar por ffmpeg.
const FORMATO = 'bestaudio[acodec=opus][ext=webm]/bestaudio';

// YouTube exige un PO Token a la mayoría de los clientes; web_embedded no,
// por eso sirve de respaldo cuando la IP del server queda marcada como bot.
const CLIENTES = process.env.YTDLP_PLAYER_CLIENTS ?? 'default,web_embedded';

const MAX_COLA = 500;
const TIMEOUT_RESOLVER = 45_000;
const TIMEOUT_LISTA = 120_000;
// Por debajo de esto, un tema que "terminó" en realidad no llegó a sonar.
const MIN_REPRODUCCION_MS = 1_500;
const INACTIVIDAD_MS = 5 * 60_000;
const CANAL_VACIO_MS = 60_000;
const MAX_FALLOS_SEGUIDOS = 3;

const sesiones = new Map();

/** Argumentos comunes a la consulta y a la descarga. */
function argsBase({ playlist = false } = {}) {
	// yt-dlp necesita un runtime JS para resolver los desafíos de YouTube; la
	// imagen ya trae Node 22, que sirve, así que no hace falta instalar Deno.
	const args = [
		'--js-runtimes',
		'node',
		playlist ? '--yes-playlist' : '--no-playlist',
		'--no-warnings',
	];

	if (CLIENTES) args.push('--extractor-args', `youtube:player_client=${CLIENTES}`);
	if (process.env.YTDLP_COOKIES) args.push('--cookies', process.env.YTDLP_COOKIES);
	if (process.env.YTDLP_EXTRA_ARGS) {
		args.push(...process.env.YTDLP_EXTRA_ARGS.split(' ').filter(Boolean));
	}

	return args;
}

/** Traduce los errores crípticos de yt-dlp a algo accionable. */
function explicarError(mensaje) {
	if (/Sign in to confirm|not a bot|cookies/i.test(mensaje)) {
		return 'YouTube está pidiendo verificación desde la IP de este servidor. Hace falta configurar cookies (YTDLP_COOKIES) o un proveedor de PO tokens.';
	}
	if (/Video unavailable|Private video/i.test(mensaje)) return 'ese video no está disponible';
	if (/age|Sign in to confirm your age/i.test(mensaje)) return 'ese video tiene restricción de edad';
	return mensaje;
}

function esUrl(texto) {
	return /^https?:\/\//i.test(texto.trim());
}

function formatearDuracion(segundos) {
	if (segundos === null || segundos === undefined) return '?';
	if (!Number.isFinite(segundos) || segundos <= 0) return 'en vivo';

	const total = Math.round(segundos);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n) => String(n).padStart(2, '0');

	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Varios "play" a la vez lanzaban varios yt-dlp en paralelo y en un server
// chico se ahogaban entre sí hasta pasar el timeout. Las consultas esperan turno
// (la espera no cuenta para el timeout); las descargas en curso no entran acá.
const MAX_CONSULTAS_PARALELAS = 2;
let consultasActivas = 0;
const esperandoTurno = [];

async function conTurno(tarea) {
	if (consultasActivas >= MAX_CONSULTAS_PARALELAS) {
		await new Promise((resolve) => esperandoTurno.push(resolve));
	}
	consultasActivas += 1;
	try {
		return await tarea();
	} finally {
		consultasActivas -= 1;
		esperandoTurno.shift()?.();
	}
}

function ejecutarYtdlp(args, opciones) {
	return conTurno(() => ejecutarYtdlpYa(args, opciones));
}

function ejecutarYtdlpYa(args, { timeout }) {
	return new Promise((resolve, reject) => {
		const proceso = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'] });

		let salida = '';
		let error = '';
		const temporizador = setTimeout(() => {
			proceso.kill('SIGKILL');
			reject(new Error('yt-dlp tardó demasiado'));
		}, timeout);

		proceso.stdout.on('data', (trozo) => (salida += trozo));
		proceso.stderr.on('data', (trozo) => (error += trozo));

		proceso.on('error', (err) => {
			clearTimeout(temporizador);
			reject(
				err.code === 'ENOENT'
					? new Error('yt-dlp no está instalado en el contenedor')
					: err,
			);
		});

		proceso.on('close', (codigo) => {
			clearTimeout(temporizador);
			if (codigo === 0 && salida.trim()) {
				resolve(salida);
				return;
			}
			const ultima = error.trim().split('\n').pop() || `yt-dlp salió con código ${codigo}`;
			reject(new Error(explicarError(ultima.replace(/^ERROR:\s*/, ''))));
		});
	});
}

function esUrlYoutube(texto) {
	try {
		return /(^|\.)(youtube\.com|youtu\.be)$/i.test(new URL(texto.trim()).hostname);
	} catch {
		return false;
	}
}

/**
 * Título de un video de YouTube sin yt-dlp (oEmbed, una request liviana).
 * La extracción completa (formatos + desafío JS) puede tardar más de 45 s en
 * un server chico y acá solo hace falta el nombre: el audio se resuelve al tocar.
 */
async function infoOembed(url) {
	const respuesta = await fetch(
		`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.trim())}`,
		{ signal: AbortSignal.timeout(8_000) },
	);
	if (!respuesta.ok) throw new Error(`oEmbed ${respuesta.status}`);
	const datos = await respuesta.json();
	if (!datos?.title) throw new Error('oEmbed sin título');

	return {
		titulo: datos.title,
		url: url.trim(),
		duracion: null,
		autor: datos.author_name ?? 'desconocido',
		sitio: 'Youtube',
	};
}

/** Busca el tema (por URL de cualquier sitio soportado, o por nombre en YouTube). */
async function resolver(consulta) {
	// Por nombre: búsqueda "plana", sin resolver formatos (~1-2 s en vez de 30+).
	if (!esUrl(consulta)) {
		const crudo = await ejecutarYtdlp(
			[...argsBase({ playlist: true }), '--flat-playlist', '-J', `ytsearch1:${consulta}`],
			{ timeout: TIMEOUT_RESOLVER },
		);
		const e = JSON.parse(crudo).entries?.[0];
		if (!e?.title) throw new Error('no encontré nada con eso');

		return {
			titulo: e.title,
			url: e.url ?? `https://www.youtube.com/watch?v=${e.id}`,
			duracion: e.duration ?? null,
			autor: e.channel ?? e.uploader ?? 'desconocido',
			sitio: 'Youtube',
		};
	}

	if (esUrlYoutube(consulta)) {
		try {
			return await infoOembed(consulta);
		} catch (error) {
			console.error('[musica] oEmbed, pruebo con yt-dlp:', error.message);
		}
	}

	const objetivo = consulta.trim();
	const crudo = await ejecutarYtdlp([...argsBase(), '-J', '-f', FORMATO, objetivo], {
		timeout: TIMEOUT_RESOLVER,
	});

	const datos = JSON.parse(crudo);
	// Una búsqueda devuelve una playlist con un solo resultado.
	const info = datos.entries?.[0] ?? datos;

	if (!info?.title) throw new Error('no encontré nada con eso');

	return {
		titulo: info.title,
		url: info.webpage_url ?? info.original_url ?? objetivo,
		duracion: info.duration ?? null,
		autor: info.uploader ?? info.channel ?? info.extractor_key ?? 'desconocido',
		sitio: info.extractor_key ?? 'desconocido',
		opus: info.acodec === 'opus' && info.ext === 'webm',
	};
}

/**
 * Link de playlist de YouTube. Los "mix" (list=RD…) son listas infinitas que
 * arma YouTube a partir de un video: ahí se reproduce solo el video.
 */
function esPlaylistYoutube(texto) {
	let url;
	try {
		url = new URL(texto.trim());
	} catch {
		return false;
	}
	if (!/(^|\.)(youtube\.com|youtu\.be)$/i.test(url.hostname)) return false;

	// Álbum de YouTube Music abierto desde la ficha (sin list=).
	if (/^\/browse\/MPREb_/.test(url.pathname)) return true;

	const lista = url.searchParams.get('list');
	if (!lista) return false;
	if (/^RD/.test(lista) && url.searchParams.get('v')) return false;
	return true;
}

function esLista(consulta) {
	return spotify.esSpotify(consulta) || esPlaylistYoutube(consulta);
}

const NO_DISPONIBLE = /^\[(private|deleted) video\]$/i;

/** Playlist de YouTube: solo el índice (sin resolver formatos), es rápido. */
async function listaYoutube(url, maximo) {
	const crudo = await ejecutarYtdlp(
		[
			...argsBase({ playlist: true }),
			'--flat-playlist',
			'-J',
			'--playlist-end',
			String(maximo),
			url.trim(),
		],
		{ timeout: TIMEOUT_LISTA },
	);
	const datos = JSON.parse(crudo);

	const pistas = (datos.entries ?? [])
		.filter((e) => e?.title && !NO_DISPONIBLE.test(e.title))
		.map((e) => ({
			titulo: e.title,
			url: e.url ?? (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null),
			duracion: e.duration ?? null,
			autor: e.channel ?? e.uploader ?? 'desconocido',
			sitio: 'Youtube',
		}))
		.filter((p) => p.url);

	return {
		nombre: datos.title ?? 'playlist',
		pistas,
		total: datos.playlist_count ?? pistas.length,
	};
}

/** Spotify: guarda "artista - tema"; se busca en YouTube recién al tocarle. */
async function listaSpotify(url, maximo) {
	const { nombre, temas, total } = await spotify.obtener(url, maximo);
	const pistas = temas.map((t) => ({
		titulo: t.titulo,
		url: null,
		busqueda: t.titulo,
		duracion: t.duracion,
		autor: t.autor,
		sitio: 'Spotify',
	}));
	return { nombre, pistas, total };
}

/** { nombre, pistas, total } para un link de playlist/álbum (YouTube o Spotify). */
async function resolverLista(consulta, maximo = MAX_COLA) {
	const lista = spotify.esSpotify(consulta)
		? await listaSpotify(consulta, maximo)
		: await listaYoutube(consulta, maximo);

	if (lista.pistas.length === 0) throw new Error('la lista está vacía o es privada');
	return lista;
}

const DUDOSAS =
	/\b(live|en vivo|cover|karaoke|instrumental|remix|8d|slowed|sped up|nightcore|reaction)\b/i;

/**
 * Busca el tema en YouTube y elige el resultado más parecido: duración
 * cercana a la de Spotify y sin "cover/live/karaoke" si no se pidió eso.
 */
async function buscarEnYoutube(busqueda, duracionEsperada) {
	const crudo = await ejecutarYtdlp(
		[...argsBase({ playlist: true }), '--flat-playlist', '-J', `ytsearch5:${busqueda}`],
		{ timeout: TIMEOUT_RESOLVER },
	);
	const candidatos = (JSON.parse(crudo).entries ?? []).filter((e) => e?.id || e?.url);
	if (candidatos.length === 0) throw new Error('no lo encontré en YouTube');

	const pedidoDudoso = DUDOSAS.test(busqueda);
	const puntaje = (e, i) => {
		let p = i * 4; // el orden de YouTube algo vale
		if (duracionEsperada && e.duration) {
			p += Math.min(Math.abs(e.duration - duracionEsperada), 120);
		}
		if (!pedidoDudoso && DUDOSAS.test(e.title ?? '')) p += 60;
		return p;
	};

	const mejor = candidatos
		.map((e, i) => ({ e, p: puntaje(e, i) }))
		.sort((a, b) => a.p - b.p)[0].e;

	return mejor.url ?? `https://www.youtube.com/watch?v=${mejor.id}`;
}

/** Completa la URL de una pista diferida (Spotify). Reutiliza la precarga. */
function prepararPista(pista) {
	if (pista.url) return Promise.resolve();
	if (!pista.preparando) {
		pista.preparando = buscarEnYoutube(pista.busqueda, pista.duracion).then((url) => {
			pista.url = url;
		});
		pista.preparando.catch(() => {}); // el error se maneja al reproducir
	}
	return pista.preparando;
}

class Sesion {
	constructor(guild, canalTexto) {
		this.guild = guild;
		this.canalTexto = canalTexto;
		this.cola = [];
		this.actual = null;
		this.conexion = null;
		this.descargador = null;
		this.fallosSeguidos = 0;
		this.destruida = false;
		this.temporizador = null;
		// Cada arranque de tema incrementa el turno; un paso async que vuelve con
		// un turno viejo (saltaron o cortaron mientras tanto) se descarta.
		this.turno = 0;
		this.saltando = false;
		this.ultimoError = '';

		this.player = createAudioPlayer({
			behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
		});

		this.player.on('error', (error) => {
			console.error('[musica] player:', error.message);
			this.avisar(`Se cortó **${this.actual?.titulo ?? 'el tema'}**, sigo con la cola.`);
			// Después del error el player pasa a Idle y ese evento arranca el próximo;
			// marcarlo como salteado evita contarlo (y avisarlo) dos veces.
			this.saltando = true;
		});

		this.player.on(AudioPlayerStatus.Idle, (anterior) => {
			const sono = anterior.resource?.playbackDuration ?? 0;
			const salteado = this.saltando;
			const pista = this.actual;
			this.saltando = false;
			this.matarDescargador();

			// yt-dlp falló antes de mandar audio: el recurso "termina" al instante.
			if (!salteado && pista && sono < MIN_REPRODUCCION_MS) {
				const motivo = explicarError(this.ultimoError || 'no llegó audio');
				if (!this.registrarFallo(pista, motivo)) return;
			} else if (!salteado) {
				this.fallosSeguidos = 0;
			}
			this.siguiente();
		});
	}

	get sonando() {
		return this.player.state.status === AudioPlayerStatus.Playing;
	}

	get pausada() {
		return this.player.state.status === AudioPlayerStatus.Paused;
	}

	avisar(texto) {
		this.canalTexto?.send(texto).catch(() => {});
	}

	/**
	 * Si la conexión no llega a Ready, se tira y se arma una nueva: antes la
	 * conexión trabada quedaba viva y cada "play" siguiente la reutilizaba y
	 * volvía a fallar con "The operation was aborted".
	 */
	async conectar(canalVoz) {
		try {
			await this.conectarUnaVez(canalVoz, false);
		} catch (error) {
			console.error('[musica] la voz no quedó lista, reintento de cero:', error.message);
			try {
				await this.conectarUnaVez(canalVoz, true);
			} catch (otro) {
				getVoiceConnection(this.guild.id)?.destroy();
				this.conexion = null;
				throw otro;
			}
		}
	}

	async conectarUnaVez(canalVoz, deCero) {
		const existente = getVoiceConnection(this.guild.id);

		if (!deCero && existente && existente.joinConfig.channelId === canalVoz.id) {
			this.conexion = existente;
		} else {
			existente?.destroy();
			this.conexion = joinVoiceChannel({
				channelId: canalVoz.id,
				guildId: this.guild.id,
				adapterCreator: this.guild.voiceAdapterCreator,
				selfDeaf: true,
			});
			this.conexion.on('error', (error) =>
				console.error('[musica] conexión:', error.message),
			);

			// Discord mueve las sesiones de voz de servidor cada tanto. Sin esto la
			// conexión queda en Disconnected para siempre y el bot se va del canal
			// en mitad de un tema, sin ningún error.
			const conexion = this.conexion;
			conexion.on(VoiceConnectionStatus.Disconnected, async () => {
				// Una conexión vieja que ya se reemplazó no cierra la sesión.
				if (this.destruida || this.conexion !== conexion) return;
				try {
					await Promise.race([
						entersState(conexion, VoiceConnectionStatus.Signalling, 5_000),
						entersState(conexion, VoiceConnectionStatus.Connecting, 5_000),
					]);
					console.log('[musica] reconectando…');
				} catch {
					this.destruir('se cayó la conexión de voz');
				}
			});
		}

		await entersState(this.conexion, VoiceConnectionStatus.Ready, 20_000);
		this.conexion.subscribe(this.player);
		this.canalVozId = canalVoz.id;
	}

	agregar(pista) {
		if (this.cola.length >= MAX_COLA) {
			throw new Error(`la cola está llena (${MAX_COLA} temas)`);
		}
		this.cola.push(pista);
		this.cancelarInactividad();
	}

	/** Agrega lo que entre; devuelve cuántas pistas quedaron en la cola. */
	agregarVarias(pistas) {
		const lugar = Math.max(0, MAX_COLA - this.cola.length);
		const entran = pistas.slice(0, lugar);
		this.cola.push(...entran);
		if (entran.length) this.cancelarInactividad();
		return entran.length;
	}

	/** Busca en YouTube el próximo tema de Spotify mientras suena el actual. */
	precargar() {
		const proxima = this.cola[0];
		if (proxima && !proxima.url) prepararPista(proxima);
	}

	matarDescargador() {
		if (!this.descargador) return;
		this.descargador.removeAllListeners();
		this.descargador.kill('SIGKILL');
		this.descargador = null;
	}

	/** Arranca el siguiente tema; si no queda nada, programa la desconexión. */
	async siguiente() {
		if (this.destruida) return;

		const turno = ++this.turno;
		const vigente = () => !this.destruida && turno === this.turno;

		const pista = this.cola.shift();
		if (!pista) {
			this.actual = null;
			this.programarInactividad(INACTIVIDAD_MS, 'cola vacía');
			return;
		}

		this.actual = pista;
		this.ultimoError = '';

		// Los temas de Spotify se buscan en YouTube recién ahora (o en la precarga).
		try {
			await prepararPista(pista);
		} catch (error) {
			if (!vigente()) return;
			if (this.registrarFallo(pista, explicarError(error.message))) this.siguiente();
			return;
		}
		if (!vigente()) return;

		const proceso = spawn(
			YTDLP,
			[...argsBase(), '-f', FORMATO, '-o', '-', pista.url],
			{ stdio: ['ignore', 'pipe', 'pipe'] },
		);
		this.descargador = proceso;

		proceso.stderr.on('data', (trozo) => {
			const linea = String(trozo).trim().split('\n').pop();
			if (/ERROR/.test(linea)) this.ultimoError = linea.replace(/^ERROR:\s*/, '');
		});
		proceso.on('error', (error) => {
			console.error('[musica] yt-dlp:', error.message);
			this.ultimoError =
				error.code === 'ENOENT' ? 'yt-dlp no está instalado en el contenedor' : error.message;
		});
		proceso.on('close', (codigo) => {
			if (codigo !== 0 && codigo !== null && this.actual === pista) {
				console.error('[musica] yt-dlp:', this.ultimoError || `código ${codigo}`);
			}
		});

		// demuxProbe detecta webm/opus (va directo, sin ffmpeg) o cae a Arbitrary.
		let sondeo;
		try {
			sondeo = await demuxProbe(proceso.stdout);
		} catch {
			sondeo = { stream: proceso.stdout, type: StreamType.Arbitrary };
		}
		if (!vigente()) {
			if (this.descargador === proceso) this.matarDescargador();
			else proceso.kill('SIGKILL');
			return;
		}

		this.player.play(createAudioResource(sondeo.stream, { inputType: sondeo.type }));
		this.avisar(
			`▶️ **${pista.titulo}** \`${formatearDuracion(pista.duracion)}\` — pedido por ${pista.pedidoPor}`,
		);
		this.precargar();
	}

	/** Cuenta un tema fallido. Devuelve false si cortó la sesión. */
	registrarFallo(pista, motivo) {
		this.fallosSeguidos += 1;
		this.avisar(`No pude reproducir **${pista.titulo}** (${motivo}).`);

		if (this.fallosSeguidos >= MAX_FALLOS_SEGUIDOS) {
			this.avisar('Fallaron varios temas seguidos, corto acá.');
			this.destruir('varios temas fallidos seguidos');
			return false;
		}
		return true;
	}

	saltar() {
		const salteado = this.actual;

		if (this.player.state.status === AudioPlayerStatus.Idle) {
			// Todavía preparando el tema: no va a haber un Idle que dispare el próximo.
			this.matarDescargador();
			this.siguiente();
		} else {
			this.saltando = true;
			this.matarDescargador();
			this.player.stop(true);
		}
		return salteado;
	}

	pausar() {
		return this.player.pause();
	}

	reanudar() {
		this.cancelarInactividad();
		return this.player.unpause();
	}

	programarInactividad(ms = INACTIVIDAD_MS, motivo = 'inactividad') {
		this.cancelarInactividad();
		this.temporizador = setTimeout(() => {
			// Revalida al disparar: el canal pudo volver a llenarse.
			if (motivo === 'canal vacío' && this.hayOyentes()) return;
			this.destruir(motivo);
		}, ms);
	}

	hayOyentes() {
		const canal = this.guild.channels.cache.get(this.canalVozId);
		if (!canal) return false;
		return canal.members.some((miembro) => !miembro.user.bot);
	}

	cancelarInactividad() {
		if (this.temporizador) {
			clearTimeout(this.temporizador);
			this.temporizador = null;
		}
	}

	destruir(motivo = 'pedido manual') {
		if (this.destruida) return;
		this.destruida = true;
		console.log(`[musica] cierro sesión en ${this.guild.name}: ${motivo}`);

		this.cancelarInactividad();
		this.cola = [];
		this.actual = null;
		this.matarDescargador();
		this.player.stop(true);
		this.player.removeAllListeners();
		getVoiceConnection(this.guild.id)?.destroy();
		sesiones.delete(this.guild.id);
	}
}

function obtenerSesion(guildId) {
	return sesiones.get(guildId) ?? null;
}

function crearSesion(guild, canalTexto) {
	const existente = sesiones.get(guild.id);
	if (existente) {
		existente.canalTexto = canalTexto;
		return existente;
	}

	const sesion = new Sesion(guild, canalTexto);
	sesiones.set(guild.id, sesion);
	return sesion;
}

/** Cuelga si el bot queda solo en el canal de voz. */
function iniciar(client) {
	if (client.__musicaIniciada) return;
	client.__musicaIniciada = true;

	client.on('voiceStateUpdate', (anterior) => {
		const sesion = sesiones.get(anterior.guild?.id);
		if (!sesion || !sesion.canalVozId) return;

		const canal = anterior.guild.channels.cache.get(sesion.canalVozId);
		if (!canal) return;

		const humanos = canal.members.filter((miembro) => !miembro.user.bot).size;
		if (humanos === 0) {
			sesion.programarInactividad(CANAL_VACIO_MS, 'canal vacío');
		} else {
			sesion.cancelarInactividad();
		}
	});
}

module.exports = {
	iniciar,
	resolver,
	resolverLista,
	esLista,
	obtenerSesion,
	crearSesion,
	formatearDuracion,
	MAX_COLA,
};
