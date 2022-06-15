module.exports = {
	name: 'pussy',
	description: 'pos gatitos(?!',
	execute(message, args) {
        const start = async function(){
            // https://npm.io/package/discord-nsfw
            const Discord = require("discord.js");
            const NSFW = require("discord-nsfw");
            const nsfw = new NSFW();

            const image = await nsfw.pussy();
            return message.reply(image);
        }
        start();
    },
};