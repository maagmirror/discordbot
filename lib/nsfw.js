'use strict';

const NSFW = require('discord-nsfw');

const cliente = new NSFW();

async function traerImagen(metodo) {
	if (typeof cliente[metodo] !== 'function') {
		throw new Error(`discord-nsfw no expone el metodo "${metodo}"`);
	}

	const resultado = await cliente[metodo]();
	const url = typeof resultado === 'string' ? resultado : resultado?.url;

	if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
		return null;
	}

	return url;
}

async function traerImagenConRespaldo(metodos, etiqueta) {
	let ultimoError = null;

	for (const metodo of metodos) {
		try {
			const url = await traerImagen(metodo);
			if (url) return url;
		} catch (error) {
			ultimoError = error;
			console.warn(`[nsfw:${etiqueta}] "${metodo}" falló: ${error.message}`);
		}
	}

	if (ultimoError) throw ultimoError;
	return null;
}

function comandoNsfw({ name, description, metodo }) {
	const metodos = Array.isArray(metodo) ? metodo : [metodo];

	return {
		name,
		description,
		nsfw: true,
		async run(ctx) {
			await ctx.defer();
			try {
				const url = await traerImagenConRespaldo(metodos, name);
				await ctx.reply(url ?? 'La fuente de imágenes no me respondió, probá de nuevo.');
			} catch (error) {
				console.error(`[nsfw:${name}]`, error.message);
				await ctx.reply('La fuente de imágenes está caída :c');
			}
		},
	};
}

module.exports = { traerImagen, traerImagenConRespaldo, comandoNsfw };
