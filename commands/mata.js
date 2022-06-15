module.exports = {
	name: 'mata',
	description: 'matá a un usuario',
	execute(message, args) {
        // const { MessageMentions: { USERS_PATTERN } } = require('discord.js');
        if (args[1]){
            message.react('🔪');
            return message.reply("pew pew pew " + args[1]  + "\n" + " https://i.imgur.com/EazNiYy.gif");
        }else{
            message.react('🔪');
            return message.reply("pew pew pew " + args[0]  + "\n" + " https://i.imgur.com/EazNiYy.gif");
        }

	},
};