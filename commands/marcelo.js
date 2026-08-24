'use strict';

module.exports = {
	name: 'marcelo',
	description: 'Conocés a Marcelo?!',
	async run(ctx) {
		await ctx.reply('Agachate y conocelo');
		await ctx.react('😄');
	},
};
