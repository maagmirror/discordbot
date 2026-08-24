'use strict';

module.exports = {
	name: 'ping',
	description: 'Ping!',
	async run(ctx) {
		const latencia = Math.round(ctx.client.ws.ping);
		await ctx.reply(`Pong. (${latencia} ms)`);
	},
};
