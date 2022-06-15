module.exports = {
	name: 'roll',
	description: 'un número random!',
	execute(message, args) {
		return message.reply(`Sacaste un ${Math.floor((Math.random() * 6) + 1)}`);
	},
};