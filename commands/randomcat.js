'use strict';

module.exports = {
	name: 'randomcat',
	description: 'un gatito random!',
	async run(ctx) {
		await ctx.defer();

		try {
			const respuesta = await fetch('https://api.thecatapi.com/v1/images/search', {
				signal: AbortSignal.timeout(10_000),
			});
			if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

			const [gato] = await respuesta.json();
			if (!gato?.url) throw new Error('respuesta sin url');

			await ctx.reply(gato.url);
		} catch (error) {
			console.error('[randomcat]', error.message);
			await ctx.reply('La API de gatitos no responde :c');
		}
	},
};
