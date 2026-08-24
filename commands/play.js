'use strict';

module.exports = {
	name: 'play',
	description: 'reproducir música (todavía no implementado)',
	async run(ctx) {
		await ctx.reply(
			'Este comando todavía no está implementado. Por ahora podés usar `di` ' +
				'para que hable en tu canal de voz.',
		);
	},
};
