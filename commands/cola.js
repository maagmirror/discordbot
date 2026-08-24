'use strict';

const musica = require('../lib/musica');

const A_MOSTRAR = 10;

module.exports = {
	name: 'cola',
	description: 'muestra la cola de temas',
	guildOnly: true,
	grupo: 'Música',
	async run(ctx) {
		const sesion = musica.obtenerSesion(ctx.guild.id);

		if (!sesion?.actual) {
			await ctx.reply('La cola está vacía.');
			return;
		}

		const estado = sesion.pausada ? '⏸️ Pausado' : '▶️ Sonando';
		const lineas = [
			`${estado}: **${sesion.actual.titulo}** \`${musica.formatearDuracion(
				sesion.actual.duracion,
			)}\``,
		];

		if (sesion.cola.length === 0) {
			lineas.push('\nNo hay nada más en la cola.');
		} else {
			lineas.push('');
			sesion.cola.slice(0, A_MOSTRAR).forEach((pista, indice) => {
				lineas.push(
					`\`${indice + 1}.\` ${pista.titulo} \`${musica.formatearDuracion(
						pista.duracion,
					)}\` — ${pista.pedidoPor}`,
				);
			});

			const resto = sesion.cola.length - A_MOSTRAR;
			if (resto > 0) lineas.push(`\n…y ${resto} más.`);
		}

		await ctx.reply(lineas.join('\n'));
	},
};
