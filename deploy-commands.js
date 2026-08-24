'use strict';

require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const path = require('node:path');
const pc = require('picocolors');
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID?.trim() || null;
const LIMPIAR = process.argv.includes('--clear');

if (!TOKEN || !CLIENT_ID) {
	console.error(
		pc.red('Faltan DISCORD_TOKEN y/o DISCORD_CLIENT_ID en el .env.'),
		'\nEl Client ID está en Developer Portal > tu app > General Information.',
	);
	process.exit(1);
}

function aJsonDiscord(command) {
	const opciones = (command.options ?? []).map((option) => {
		const { rest: _rest, ...limpia } = option;
		return limpia;
	});

	// Discord exige que las opciones obligatorias vayan antes que las opcionales.
	opciones.sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)));

	return {
		name: command.name,
		description: command.description.slice(0, 100),
		options: opciones,
		nsfw: Boolean(command.nsfw),
		dm_permission: !command.guildOnly,
	};
}

function cargarComandos() {
	const dir = path.join(__dirname, 'commands');
	const comandos = [];

	for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
		const command = require(path.join(dir, file));
		if (!command?.name || typeof command.run !== 'function') {
			console.warn(pc.yellow(`  ${file} ignorado (falta name o run)`));
			continue;
		}
		comandos.push(aJsonDiscord(command));
	}

	return comandos;
}

async function main() {
	const rest = new REST({ version: '10' }).setToken(TOKEN);
	const ruta = GUILD_ID
		? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
		: Routes.applicationCommands(CLIENT_ID);
	const alcance = GUILD_ID ? `el servidor ${GUILD_ID}` : 'todos los servidores (global)';

	if (LIMPIAR) {
		await rest.put(ruta, { body: [] });
		console.log(pc.green(`Slash commands borrados de ${alcance}.`));
		return;
	}

	const comandos = cargarComandos();
	console.log(pc.gray(`Registrando ${comandos.length} comandos en ${alcance}…`));

	const resultado = await rest.put(ruta, { body: comandos });

	console.log(pc.green(`Listos ${resultado.length} slash commands.`));
	if (!GUILD_ID) {
		console.log(
			pc.yellow('Registro global: Discord puede tardar hasta 1 hora en mostrarlos.'),
		);
		console.log(
			pc.gray('Para pruebas, poné DISCORD_GUILD_ID en el .env y son instantáneos.'),
		);
	}
}

main().catch((error) => {
	console.error(pc.red('Falló el registro:'), error.message);
	if (error.rawError?.errors) {
		console.error(JSON.stringify(error.rawError.errors, null, 2));
	}
	process.exit(1);
});
