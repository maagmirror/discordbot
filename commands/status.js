'use strict';

module.exports = {
	name: 'status',
	description: 'Status del bot!',
	async run(ctx) {
		const segundos = Math.floor(ctx.client.uptime / 1000);
		const horas = Math.floor(segundos / 3600);
		const minutos = Math.floor((segundos % 3600) / 60);
		await ctx.reply(
			`Operativa y funcionando :D — despierta hace ${horas}h ${minutos}m ` +
				`en ${ctx.client.guilds.cache.size} servidores.`,
		);
	},
};
