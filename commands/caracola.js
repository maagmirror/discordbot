'use strict';

const RESPUESTAS = [
	'Es cierto',
	'Es decididamente así',
	'Sin duda',
	'Sí definitivamente',
	'Puedes confiar en ello',
	'Como yo lo veo, sí',
	'Muy probable',
	'Perspectivas buenas',
	'Sí',
	'Las señales apuntan a que sí',
	'Respuesta confusa, intenta otra vez',
	'Pregunta de nuevo más tarde',
	'Mejor no decirte ahora',
	'No se puede predecir ahora',
	'Concéntrate y pregunta otra vez',
	'No cuentes con eso',
	'Mi respuesta es no',
	'Mis fuentes dicen que no',
	'Perspectivas no tan buenas',
	'Muy dudoso',
];

module.exports = {
	name: 'caracola',
	description: 'pregunta algo y la caracola decidirá!',
	options: [
		{
			name: 'pregunta',
			description: 'Lo que le querés preguntar a la caracola',
			type: 3, // STRING
			required: false,
			rest: true,
		},
	],
	async run(ctx) {
		const elegida = RESPUESTAS[Math.floor(Math.random() * RESPUESTAS.length)];
		await ctx.reply(`\`\`\`${elegida}\`\`\` https://i.imgur.com/5xAceOL.png`);
	},
};
