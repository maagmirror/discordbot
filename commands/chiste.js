'use strict';

module.exports = {
	name: 'chiste',
	description: 'Cuenta un chiste',
	async run(ctx) {
		await ctx.defer();

		try {
			const respuesta = await fetch('https://v2.jokeapi.dev/joke/Any?lang=es', {
				signal: AbortSignal.timeout(10_000),
			});
			if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

			const data = await respuesta.json();
			if (data.error) throw new Error(data.message ?? 'jokeapi devolvió error');

			const chiste =
				data.type === 'single' ? data.joke : `${data.setup}\n${data.delivery}`;

			await ctx.reply(chiste);
		} catch (error) {
			console.error('[chiste]', error.message);
			await ctx.reply('No se me ocurre nada, la API de chistes no responde :c');
		}
	},
};
