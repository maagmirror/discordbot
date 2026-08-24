'use strict';

const musica = require('../lib/musica');

module.exports = {
	name: 'stop',
	description: 'para la música, vacía la cola y me voy del canal',
	guildOnly: true,
	grupo: 'Música',
	async run(ctx) {
		const sesion = musica.obtenerSesion(ctx.guild.id);

		if (!sesion) {
			await ctx.reply('No estoy reproduciendo nada.');
			return;
		}

		sesion.destruir();
		await ctx.reply('⏹️ Listo, cola vacía y me fui del canal.');
	},
};
