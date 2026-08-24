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
} = require('@discordjs/voice');

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

// Prioriza webm/opus: Discord lo transmite tal cual, sin pasar por ffmpeg.
const FORMATO = 'bestaudio[acodec=opus][ext=webm]/bestaudio';

const MAX_COLA = 100;
const TIMEOUT_RESOLVER = 45_000;
const INACTIVIDAD_MS = 5 * 60_000;
const CANAL_VACIO_MS = 60_000;
const MAX_FALLOS_SEGUIDOS = 3;

const sesiones = new Map();

function esUrl(texto) {
	return /^https?:\/\//i.test(texto.trim());
}

function formatearDuracion(segundos) {
	if (!Number.isFinite(segundos) || segundos <= 0) return 'en vivo';

	const total = Math.round(segundos);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const pad = (n) => String(n).padStart(2, '0');

	return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function ejecutarYtdlp(args, { timeout }) {
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
			reject(new Error(ultima.replace(/^ERROR:\s*/, '')));
		});
	});
}

/** Busca el tema (por URL de cualquier sitio soportado, o por nombre en YouTube). */
async function resolver(consulta) {
	const objetivo = esUrl(consulta) ? consulta.trim() : `ytsearch1:${consulta}`;
	const crudo = await ejecutarYtdlp(
		['-J', '--no-playlist', '--no-warnings', '-f', FORMATO, objetivo],
		{ timeout: TIMEOUT_RESOLVER },
	);

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

		this.player = createAudioPlayer({
			behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
		});

		this.player.on('error', (error) => {
			console.error('[musica] player:', error.message);
			this.avisar(`Se cortó **${this.actual?.titulo ?? 'el tema'}**, sigo con la cola.`);
			this.siguiente();
		});

		this.player.on(AudioPlayerStatus.Idle, () => {
			this.matarDescargador();
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

	async conectar(canalVoz) {
		const existente = getVoiceConnection(this.guild.id);

		if (existente && existente.joinConfig.channelId === canalVoz.id) {
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
			this.conexion.on(VoiceConnectionStatus.Disconnected, async () => {
				if (this.destruida) return;
				try {
					await Promise.race([
						entersState(this.conexion, VoiceConnectionStatus.Signalling, 5_000),
						entersState(this.conexion, VoiceConnectionStatus.Connecting, 5_000),
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

	matarDescargador() {
		if (!this.descargador) return;
		this.descargador.removeAllListeners();
		this.descargador.kill('SIGKILL');
		this.descargador = null;
	}

	/** Arranca el siguiente tema; si no queda nada, programa la desconexión. */
	siguiente() {
		if (this.destruida) return;

		const pista = this.cola.shift();
		if (!pista) {
			this.actual = null;
			this.programarInactividad(INACTIVIDAD_MS, 'cola vacía');
			return;
		}

		this.actual = pista;

		const proceso = spawn(
			YTDLP,
			['-f', FORMATO, '--no-playlist', '--no-warnings', '-o', '-', pista.url],
			{ stdio: ['ignore', 'pipe', 'pipe'] },
		);
		this.descargador = proceso;

		let errorSalida = '';
		proceso.stderr.on('data', (trozo) => (errorSalida += trozo));
		proceso.on('error', (error) => {
			console.error('[musica] yt-dlp:', error.message);
			this.fallar(pista, error.message);
		});
		proceso.on('close', (codigo) => {
			if (codigo !== 0 && codigo !== null && this.actual === pista) {
				console.error('[musica] yt-dlp:', errorSalida.trim().split('\n').pop());
			}
		});

		const recurso = createAudioResource(proceso.stdout, {
			inputType: pista.opus ? StreamType.WebmOpus : StreamType.Arbitrary,
		});

		this.player.play(recurso);
		this.fallosSeguidos = 0;
		this.avisar(
			`▶️ **${pista.titulo}** \`${formatearDuracion(pista.duracion)}\` — pedido por ${pista.pedidoPor}`,
		);
	}

	fallar(pista, motivo) {
		this.fallosSeguidos += 1;
		this.avisar(`No pude reproducir **${pista.titulo}** (${motivo}).`);

		if (this.fallosSeguidos >= MAX_FALLOS_SEGUIDOS) {
			this.avisar('Fallaron varios temas seguidos, corto acá.');
			this.destruir('varios temas fallidos seguidos');
			return;
		}
		this.siguiente();
	}

	saltar() {
		const salteado = this.actual;
		this.matarDescargador();
		this.player.stop(true);
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
	obtenerSesion,
	crearSesion,
	formatearDuracion,
	MAX_COLA,
};
