'use strict';

const { EmbedBuilder } = require('discord.js');

const MAX_CAMPO = 1024;

/** "play <tema>" — arma el modo de uso a partir de las opciones declaradas. */
function uso(prefijo, command) {
	const partes = (command.options ?? []).map((option) =>
		option.required ? `<${option.name}>` : `[${option.name}]`,
	);
	return [`${prefijo} ${command.name}`, ...partes].join(' ');
}

/** Discord corta los campos en 1024 caracteres, así que se parten en varios. */
function trocear(lineas) {
	const bloques = [];
	let actual = '';

	for (const linea of lineas) {
		if (actual && actual.length + linea.length + 1 > MAX_CAMPO) {
			bloques.push(actual);
			actual = linea;
		} else {
			actual = actual ? `${actual}\n${linea}` : linea;
		}
	}
	if (actual) bloques.push(actual);

	return bloques;
}

function agregarSeccion(embed, titulo, lineas) {
	if (lineas.length === 0) return;

	trocear(lineas).forEach((bloque, indice) => {
		embed.addFields({
			name: indice === 0 ? titulo : `${titulo} (cont.)`,
			value: bloque,
		});
	});
}

module.exports = {
	name: 'help',
	description: 'muestra los comandos disponibles',
	async run(ctx) {
		const prefijo = (process.env.PREFIX ?? 'maggy').trim();

		const comandos = [...ctx.client.commands.values()].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		const grupos = new Map();
		for (const command of comandos) {
			const grupo = command.nsfw
				? 'NSFW (solo en canales NSFW)'
				: (command.grupo ?? 'Comandos');
			if (!grupos.has(grupo)) grupos.set(grupo, []);
			grupos.get(grupo).push(`\`${uso(prefijo, command)}\` — ${command.description}`);
		}

		const embed = new EmbedBuilder()
			.setTitle('Comandos de Maggy')
			.setColor(0x5865f2)
			.setDescription(
				`Se usan con el prefijo \`${prefijo}\` o como slash commands (\`/\`).\n` +
					'`<obligatorio>` · `[opcional]`',
			);

		// Música primero, NSFW al final, el resto en el medio.
		const orden = [...grupos.keys()].sort((a, b) => {
			const peso = (nombre) =>
				nombre.startsWith('NSFW') ? 2 : nombre === 'Música' ? 0 : 1;
			return peso(a) - peso(b) || a.localeCompare(b);
		});

		for (const grupo of orden) agregarSeccion(embed, grupo, grupos.get(grupo));

		const enviado = await ctx.dm({ embeds: [embed] });

		if (enviado) {
			await ctx.reply('Te respondí al privado UwU');
		} else {
			await ctx.reply({
				content: 'No puedo escribirte al privado, así que va por acá:',
				embeds: [embed],
			});
		}
	},
};
