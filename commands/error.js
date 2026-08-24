'use strict';

// https://http.cat solo tiene imagen para estos códigos.
const CODIGOS = new Set([
	100, 101, 102, 103,
	200, 201, 202, 203, 204, 206, 207, 208, 214, 226,
	300, 301, 302, 303, 304, 305, 307, 308,
	400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414,
	415, 416, 417, 418, 420, 421, 422, 423, 424, 425, 426, 428, 429, 431, 444,
	450, 451, 497, 498, 499,
	500, 501, 502, 503, 504, 506, 507, 508, 509, 510, 511, 521, 522, 523, 525, 599,
]);

module.exports = {
	name: 'error',
	description: 'error cat, dile un número de error!',
	options: [
		{
			name: 'codigo',
			description: 'Código HTTP. Ej: 404',
			type: 4, // INTEGER
			required: true,
		},
	],
	async run(ctx) {
		const codigo = Number.parseInt(ctx.arg('codigo') ?? '', 10);

		if (!Number.isFinite(codigo)) {
			await ctx.reply('Decime un número de error. Ej: `404`');
			return;
		}

		if (!CODIGOS.has(codigo)) {
			await ctx.reply(`No existe gatito para el código ${codigo} :c`);
			return;
		}

		await ctx.reply(`https://http.cat/${codigo}`);
	},
};
