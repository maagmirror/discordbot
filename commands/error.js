module.exports = {
	name: 'error',
	description: 'error cat, dile un número de error!',
	execute(message, args) {
		message.reply('https://http.cat/' + args[0]);
	},
};