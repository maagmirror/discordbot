'use strict';

const SUBREDDITS = ['memexico', 'SpanishMeme', 'MemesEspanol', 'dankmemes'];

async function pedirMeme(url) {
	const respuesta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
	if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

	const data = await respuesta.json();
	if (!data?.url) throw new Error('respuesta sin url');

	return data;
}

module.exports = {
	name: 'meme',
	description: 'Un memardo nuevo (ahora sí en español c:)',
	async run(ctx) {
		await ctx.defer();

		const orden = [...SUBREDDITS].sort(() => Math.random() - 0.5);
		const candidatos = [
			...orden.map((sub) => `https://meme-api.com/gimme/${sub}`),
			'https://meme-api.com/gimme',
		];

		for (const url of candidatos) {
			try {
				const meme = await pedirMeme(url);

				if (meme.nsfw && !ctx.isNsfw) continue;

				await ctx.reply(`**${meme.title}**\n${meme.url}`);
				return;
			} catch (error) {
				console.warn(`[meme] ${url} falló: ${error.message}`);
			}
		}

		await ctx.reply('No encontré ningún meme, la API está de paro :c');
	},
};
