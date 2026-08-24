'use strict';

const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'help',
	description: 'Muestra los comandos disponibles!',
	async run(ctx) {
		const prefijo = (process.env.PREFIX ?? 'maggy').trim();

		const comandos = [...ctx.client.commands.values()].sort((a, b) =>
			a.name.localeCompare(b.name),
		);

		const normales = comandos.filter((c) => !c.nsfw);
		const picantes = comandos.filter((c) => c.nsfw);

		const formatear = (lista) =>
			lista.map((c) => `\`${prefijo} ${c.name}\` — ${c.description}`).join('\n');

		const embed = new EmbedBuilder()
			.setTitle('Comandos de Maggy')
			.setColor(0x5865f2)
			.setDescription(
				`Podés usarlos con el prefijo \`${prefijo}\` o como slash commands (\`/\`).`,
			)
			.addFields({ name: 'Comandos', value: formatear(normales) || 'ninguno' });

		if (picantes.length > 0) {
			embed.addFields({
				name: 'NSFW (solo en canales marcados NSFW)',
				value: formatear(picantes),
			});
		}

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
