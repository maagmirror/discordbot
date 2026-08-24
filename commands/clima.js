'use strict';

const { EmbedBuilder } = require('discord.js');

module.exports = {
	name: 'clima',
	description: 'Comprueba un pronóstico del tiempo',
	options: [
		{
			name: 'ubicacion',
			description: 'Ciudad o localidad. Ej: Montevideo',
			type: 3, // STRING
			required: true,
			rest: true,
		},
	],
	async run(ctx) {
		const apiKey = process.env.WEATHERAPI;

		if (!apiKey) {
			await ctx.reply(
				'No tengo configurada la API key del clima (WEATHERAPI en el .env).',
			);
			return;
		}

		const ubicacion = ctx.arg('ubicacion');

		if (!ubicacion) {
			await ctx.reply('Por favor proporcioná una ubicación para comprobar el clima.');
			return;
		}

		await ctx.defer();

		try {
			const url = new URL('https://api.weatherapi.com/v1/current.json');
			url.searchParams.set('key', apiKey);
			url.searchParams.set('q', ubicacion);
			url.searchParams.set('aqi', 'no');
			url.searchParams.set('lang', 'es');

			const respuesta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
			const data = await respuesta.json();

			if (data.error) {
				await ctx.reply(data.error.message);
				return;
			}
			if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

			const embed = new EmbedBuilder()
				.setAuthor({ name: `Pronóstico del tiempo para ${data.location.name}` })
				.setDescription(`**${data.current.condition.text}**`)
				.setThumbnail(`https:${data.current.condition.icon}`)
				.setColor(0x111111)
				.addFields(
					{ name: 'Tipo de grado', value: 'Celsius', inline: true },
					{ name: 'Temperatura', value: `${data.current.temp_c}°`, inline: true },
					{ name: 'Se siente como', value: `${data.current.feelslike_c}°`, inline: true },
					{ name: 'Humedad', value: `${data.current.humidity}%`, inline: true },
					{ name: 'Viento', value: `${data.current.wind_kph} km/h`, inline: true },
				)
				.setFooter({ text: `${data.location.region}, ${data.location.country}` });

			await ctx.reply({ embeds: [embed] });
		} catch (error) {
			console.error('[clima]', error.message);
			await ctx.reply('No pude consultar el clima ahora mismo :c');
		}
	},
};
