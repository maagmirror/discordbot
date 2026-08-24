'use strict';

const wiki = require('wikipedia');

module.exports = {
	name: 'define',
	description: 'maggy define contrato — busca en Wikipedia',
	options: [
		{
			name: 'termino',
			description: 'Qué querés que busque',
			type: 3, // STRING
			required: true,
			rest: true,
		},
	],
	async run(ctx) {
		const termino = ctx.arg('termino');

		if (!termino) {
			await ctx.reply('Decime qué buscar. Ej: `define contrato`');
			return;
		}

		await ctx.defer();

		try {
			await wiki.setLang('es');

			const resultados = await wiki.search(termino, { limit: 1 });
			const titulo = resultados?.results?.[0]?.title ?? termino;

			const pagina = await wiki.page(titulo, { autoSuggest: true });
			const resumen = await pagina.summary();

			if (!resumen?.extract) throw new Error('sin extracto');

			await ctx.reply({
				content: `**${resumen.title}**\n${resumen.extract}\n<${
					resumen.content_urls?.desktop?.page ?? ''
				}>`,
			});
		} catch (error) {
			console.error('[define]', error.message);
			await ctx.reply(`No encontré nada sobre "${termino}" en Wikipedia :c`);
		}
	},
};
