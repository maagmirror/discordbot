module.exports = {
	name: 'caracola',
	description: 'pregunta algo y la caracola decidira!',
	execute(message, args) {

		const replies = [
        "Es cierto",
        "Es decididamente así",
        "Sin duda",
        "Sí definitivamente",
        "Puedes confiar en ello",
        "Como yo lo veo, sí",
        "Más probable",
        "Perspectivas buena",
        "Sí",
        "Las señales apuntan a que sí",
        "Respuesta confusa, intenta otra vez",
        "Pregunta de nuevo más tarde",
        "Mejor no decirte ahora",
        "No se puede predecir ahora",
        "Concéntrate y pregunta otra vez",
        "No cuentes con eso",
        "Mi respuesta es no",
        "Mis fuentes dicen que no",
        "Perspectivas no tan buenas",
        "Muy dudoso"
        ];

        message.replytext = Math.floor((Math.random() * replies.length) + 0);
		return message.reply("```" + replies[message.replytext] + "``` https://i.imgur.com/5xAceOL.png");
	},
};