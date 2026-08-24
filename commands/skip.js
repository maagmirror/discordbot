'use strict';

const musica = require('../lib/musica');

module.exports = {
	name: 'skip',
	description: 'saltea el tema que está sonando',
	guildOnly: true,
	grupo: 'Música',
	async run(ctx) {
		const sesion = musica.obtenerSesion(ctx.guild.id);

		if (!sesion?.actual) {
			await ctx.reply('No hay nada sonando.');
			return;
		}

		const salteado = sesion.saltar();
		await ctx.reply(`⏭️ Salteado **${salteado.titulo}**.`);
	},
};
