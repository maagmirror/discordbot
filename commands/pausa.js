'use strict';

const musica = require('../lib/musica');

module.exports = {
	name: 'pausa',
	description: 'pausa o reanuda lo que esté sonando',
	guildOnly: true,
	grupo: 'Música',
	async run(ctx) {
		const sesion = musica.obtenerSesion(ctx.guild.id);

		if (!sesion?.actual) {
			await ctx.reply('No hay nada sonando.');
			return;
		}

		if (sesion.pausada) {
			sesion.reanudar();
			await ctx.reply(`▶️ Sigo con **${sesion.actual.titulo}**.`);
			return;
		}

		sesion.pausar();
		await ctx.reply(`⏸️ Pausado **${sesion.actual.titulo}**.`);
	},
};
