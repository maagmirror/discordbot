module.exports = {
	name: 'marcelo',
	description: 'Conoces a Marcelo?!',
	execute(message, args) {
		message.reply('Agachate y conocelo');
        message.react('😄');
	},
};