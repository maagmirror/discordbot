'use strict';

const discordTTS = require('discord-tts');
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

const MAX_CARACTERES = 200;
const IDIOMA = 'es';

const DEBUG = Boolean(process.env.VOICE_DEBUG);
const log = (...args) => DEBUG && console.log('[di]', ...args);

function espiarConexion(conexion) {
	if (!DEBUG) return;

	const vistos = new WeakSet();

	const espiarWs = (ws) => {
		if (!ws || vistos.has(ws)) return;
		vistos.add(ws);
		ws.on('close', (ev) => log('ws CLOSE code=', ev?.code, 'reason=', ev?.reason));
		ws.on('error', (error) => log('ws error:', error?.message));
	};

	const espiarNet = (net) => {
		if (!net || vistos.has(net)) return;
		vistos.add(net);
		espiarWs(net.state?.ws);
		net.on('stateChange', (anterior, nuevo) => {
			log('net:', anterior.code, '->', nuevo.code);
			espiarWs(nuevo.ws);
		});
		net.on('error', (error) => log('net error:', error.message));
	};

	conexion.on('stateChange', (anterior, nuevo) => {
		log(`conexión: ${anterior.status} -> ${nuevo.status}`);
		espiarNet(nuevo.networking);
	});
}

function esperarFinDeReproduccion(player, msMaximo) {
	return new Promise((resolve, reject) => {
		const limpiar = () => {
			clearTimeout(temporizador);
			player.off('stateChange', alCambiar);
			player.off('error', alFallar);
		};
		const alCambiar = (_anterior, nuevo) => {
			if (nuevo.status === AudioPlayerStatus.Idle) {
				limpiar();
				resolve();
			}
		};
		const alFallar = (error) => {
			limpiar();
			reject(error);
		};
		const temporizador = setTimeout(() => {
			limpiar();
			resolve();
		}, msMaximo);

		player.on('stateChange', alCambiar);
		player.once('error', alFallar);

		if (player.state.status === AudioPlayerStatus.Idle) {
			limpiar();
			resolve();
		}
	});
}

module.exports = {
	name: 'di',
	description: 'dice algo en tu canal de voz',
	guildOnly: true,
	options: [
		{
			name: 'texto',
			description: 'Lo que querés que diga',
			type: 3, // STRING
			required: true,
			rest: true,
		},
	],
	async run(ctx) {
		const texto = (ctx.arg('texto') ?? '').trim();

		if (!texto) {
			await ctx.reply('Decime qué querés que diga. Ej: `di hola a todos`');
			return;
		}
		if (texto.length > MAX_CARACTERES) {
			await ctx.reply(`Muy largo. Máximo ${MAX_CARACTERES} caracteres.`);
			return;
		}

		const canal = ctx.member?.voice?.channel;
		if (!canal) {
			await ctx.reply('Tenés que estar en un canal de voz para que hable.');
			return;
		}

		const permisos = canal.permissionsFor(ctx.guild.members.me);
		if (!permisos?.has(['Connect', 'Speak'])) {
			await ctx.reply(`No tengo permiso para conectarme o hablar en **${canal.name}**.`);
			return;
		}

		await ctx.defer();

		let etapa = 'conectando';
		let conexion = getVoiceConnection(ctx.guild.id);

		try {
			if (!conexion || conexion.joinConfig.channelId !== canal.id) {
				conexion?.destroy();
				conexion = joinVoiceChannel({
					channelId: canal.id,
					guildId: ctx.guild.id,
					adapterCreator: ctx.guild.voiceAdapterCreator,
					selfDeaf: true,
				});
				conexion.on('error', (error) => console.error('[di] conexión:', error.message));
				espiarConexion(conexion);
			}

			await entersState(conexion, VoiceConnectionStatus.Ready, 20_000);

			etapa = 'generando el audio';
			const stream = discordTTS.getVoiceStream(texto, { lang: IDIOMA });
			const recurso = createAudioResource(stream, { inputType: StreamType.Arbitrary });

			etapa = 'reproduciendo';
			const player = createAudioPlayer({
				behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
			});
			player.on('stateChange', (anterior, nuevo) =>
				log(`player: ${anterior.status} -> ${nuevo.status}`),
			);
			player.on('error', (error) => console.error('[di] player:', error.message));

			conexion.subscribe(player);
			player.play(recurso);

			await ctx.reply(`🔊 ${canal.name}: ${texto}`);

			await esperarFinDeReproduccion(player, 120_000);
			player.stop();
			conexion.destroy();
		} catch (error) {
			console.error(`[di] falló ${etapa}:`, error.message);
			getVoiceConnection(ctx.guild.id)?.destroy();

			const detalle =
				etapa === 'conectando'
					? 'No pude conectarme al canal de voz (Discord no completó el handshake).'
					: `No pude reproducir el audio (falló ${etapa}).`;
			await ctx.reply(`${detalle} :c`);
		}
	},
};
