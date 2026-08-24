'use strict';

module.exports = {
	name: 'mata',
	description: 'matá a un usuario',
	options: [
		{
			name: 'victima',
			description: 'A quién querés matar',
			type: 3, // STRING
			required: true,
			rest: true,
		},
	],
	async run(ctx) {
		const victima = ctx.arg('victima');

		if (!victima) {
			await ctx.reply('¿A quién? Decime un nombre. Ej: `mata Marcelo`');
			return;
		}

		await ctx.react('🔪');
		await ctx.reply(`pew pew pew ${victima}\n https://i.imgur.com/EazNiYy.gif`);
	},
};
