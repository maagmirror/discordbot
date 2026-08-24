'use strict';

module.exports = {
	name: 'roll',
	description: 'un número random!',
	options: [
		{
			name: 'caras',
			description: 'Cantidad de caras del dado (por defecto 6)',
			type: 4, // INTEGER
			required: false,
			min_value: 2,
			max_value: 1000,
		},
	],
	async run(ctx) {
		const pedido = Number.parseInt(ctx.arg('caras') ?? '6', 10);
		const caras = Number.isFinite(pedido) ? Math.min(Math.max(pedido, 2), 1000) : 6;
		const tirada = Math.floor(Math.random() * caras) + 1;
		await ctx.reply(`Sacaste un ${tirada} (d${caras})`);
	},
};
