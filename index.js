'use strict';

require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const pc = require('picocolors');
const {
	Client,
	Collection,
	GatewayIntentBits,
	Partials,
	ActivityType,
	MessageFlags,
} = require('discord.js');

const { Ctx } = require('./lib/ctx');
const respuestas = require('./lib/respuestas');

const TOKEN = process.env.DISCORD_TOKEN;
const PREFIX = (process.env.PREFIX ?? 'maggy').trim();

if (!TOKEN) {
	console.error(pc.red('Falta DISCORD_TOKEN. Copiá .env.example a .env y completalo.'));
	process.exit(1);
}
if (!PREFIX) {
	console.error(pc.red('PREFIX no puede estar vacío.'));
	process.exit(1);
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		// Privilegiado: hay que activarlo en el Developer Portal o el bot no lee
		// el texto de los mensajes y ningún comando de prefijo responde.
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
		GatewayIntentBits.DirectMessages,
	],
	partials: [Partials.Channel], // necesario para recibir DMs
});

client.commands = new Collection();

function loadCommands() {
	const dir = path.join(__dirname, 'commands');
	const files = fs.readdirSync(dir).filter((file) => file.endsWith('.js'));

	client.commands.clear();

	for (const file of files) {
		const full = path.join(dir, file);
		try {
			delete require.cache[require.resolve(full)];
			const command = require(full);

			if (!command?.name || typeof command.run !== 'function') {
				console.warn(pc.yellow(`[comandos] ${file} ignorado: falta name o run()`));
				continue;
			}

			client.commands.set(command.name, command);
		} catch (error) {
			console.error(pc.red(`[comandos] error cargando ${file}:`), error.message);
		}
	}

	return client.commands.size;
}

async function runCommand(command, ctx) {
	if (command.nsfw && !ctx.isNsfw) {
		return ctx.reply(
			'Intentá eso, pero en un canal NSFW. Acá no puedo mandarte eso, degenerad@.',
		);
	}

	if (command.guildOnly && !ctx.guild) {
		return ctx.reply('Ese comando solo funciona dentro de un servidor.');
	}

	return command.run(ctx);
}

async function reportError(ctx, error) {
	console.error(pc.red(`[error] comando "${ctx.command?.name}":`), error);
	try {
		await ctx.reply('Se me rompió algo ejecutando eso :c');
	} catch {
		/* el canal puede haber desaparecido; ya lo logueamos arriba */
	}
}

const COLLECTOR_TIMEOUT = 30_000;
const aprendiendo = new Set();

async function handleUnknownCommand(message, textoSinPrefijo) {
	const pregunta = textoSinPrefijo.trim();
	if (!pregunta) return;

	const guardada = respuestas.get(pregunta);
	if (guardada) {
		await message.channel.send(guardada);
		return;
	}

	const claveSesion = `${message.channelId}:${message.author.id}`;
	if (aprendiendo.has(claveSesion)) return;
	aprendiendo.add(claveSesion);

	let prompt;
	try {
		prompt = await message.channel.send(
			'No tengo una respuesta guardada para eso. ¿Cómo debería responder a esta pregunta?',
		);
	} catch (error) {
		aprendiendo.delete(claveSesion);
		console.error(pc.red('[aprender] no pude preguntar:'), error.message);
		return;
	}

	const collector = message.channel.createMessageCollector({
		filter: (respuesta) =>
			respuesta.author.id === message.author.id && !respuesta.author.bot,
		time: COLLECTOR_TIMEOUT,
		max: 1,
	});

	collector.on('collect', async (respuestaUsuario) => {
		const limpia = respuestaUsuario.content.replaceAll(PREFIX, '').trim();

		if (respuestaUsuario.content.includes(PREFIX) || limpia === '') {
			await respuestaUsuario.reply('Esa respuesta está mal y no será guardada.');
			return;
		}

		await respuestas.set(pregunta, limpia);
		await respuestaUsuario.reply(
			'¡Gracias por la respuesta! La guardaré para la próxima vez.',
		);
	});

	collector.on('end', async (_collected, reason) => {
		aprendiendo.delete(claveSesion);
		if (reason === 'time') {
			await message.channel
				.send('Tiempo agotado. No se recibió respuesta :c')
				.catch(() => {});
		}
		await prompt.delete().catch(() => {});
	});
}

client.once('clientReady', () => {
	client.user.setActivity(`Generar Bugs en ${client.guilds.cache.size} servidores`, {
		type: ActivityType.Playing,
	});
	console.log(pc.green(`Conectada como ${client.user.tag}`));
	console.log(
		pc.gray(
			`Prefijo "${PREFIX}" · ${client.commands.size} comandos · ` +
				`${client.guilds.cache.size} servidores · ${respuestas.size} respuestas aprendidas`,
		),
	);
});

client.on('guildCreate', async (guild) => {
	try {
		const owner = await guild.fetchOwner();
		await owner.send(
			`¡Gracias! Podés usar \`${PREFIX} help\` para descubrir mis comandos.`,
		);
	} catch (error) {
		console.warn(
			pc.yellow(`[guildCreate] no pude saludar en ${guild.name}:`),
			error.message,
		);
	}
});

client.on('messageCreate', async (message) => {
	if (message.author.bot) return;

	const contenido = message.content ?? '';
	if (!contenido.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

	const origen = message.guild ? message.guild.name : 'DM';
	console.log(
		`${pc.green('[MENSAJE]')}${pc.green(`[${origen}]`)} ` +
			`${pc.blue(message.author.username)}: ${contenido}`,
	);

	const sinPrefijo = contenido.slice(PREFIX.length);
	const args = sinPrefijo.trim().split(/ +/);
	const nombre = (args.shift() ?? '').toLowerCase();

	const command = client.commands.get(nombre);

	if (!command) {
		await handleUnknownCommand(message, sinPrefijo).catch((error) =>
			console.error(pc.red('[aprender] falló:'), error),
		);
		return;
	}

	const ctx = new Ctx({ client, message, args, command });
	try {
		await runCommand(command, ctx);
	} catch (error) {
		await reportError(ctx, error);
	}
});

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isChatInputCommand()) return;

	const command = client.commands.get(interaction.commandName);
	if (!command) {
		await interaction
			.reply({ content: 'Ese comando ya no existe.', flags: MessageFlags.Ephemeral })
			.catch(() => {});
		return;
	}

	const origen = interaction.guild ? interaction.guild.name : 'DM';
	console.log(
		`${pc.magenta('[SLASH]')}${pc.green(`[${origen}]`)} ` +
			`${pc.blue(interaction.user.username)}: /${interaction.commandName}`,
	);

	const ctx = new Ctx({ client, interaction, command });
	try {
		await runCommand(command, ctx);
	} catch (error) {
		await reportError(ctx, error);
	}
});

respuestas.load();
console.log(pc.gray(`Cargados ${loadCommands()} comandos.`));

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		console.log(pc.gray('\nCerrando…'));
		client.destroy().finally(() => process.exit(0));
	});
}

process.on('unhandledRejection', (error) => {
	console.error(pc.red('[unhandledRejection]'), error);
});

client.login(TOKEN).catch((error) => {
	console.error(pc.red('No pude iniciar sesión en Discord:'), error.message);
	if (String(error.message).includes('disallowed intents')) {
		console.error(
			pc.yellow(
				'Activá "MESSAGE CONTENT INTENT" en Discord Developer Portal >\n' +
					'tu app > Bot > Privileged Gateway Intents.',
			),
		);
	}
	process.exit(1);
});

module.exports = { client, loadCommands };
