'use strict';

module.exports = {
	name: 'coinflip',
	description: '¡Cara o cruz!',
	async run(ctx) {
		const resultado = Math.random() < 0.5 ? '🪙 Cara' : '🪙 Cruz';

		await ctx.reply(`Salió ${resultado}`);
	},
};
