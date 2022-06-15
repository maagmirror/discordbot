module.exports = {
	name: 'hentai',
	description: 'NSFW hentai!',
	execute(message, args) {
        if (message.channel.nsfw) {
            const start = async function(){
                // https://npm.io/package/discord-nsfw
                const Discord = require("discord.js");
                const NSFW = require("discord-nsfw");
                const nsfw = new NSFW();

                const image = await nsfw.hentai();
                return message.reply(image);
            }
            start();
        } else {
            message.channel.send("Intenta eso, pero en un canal NSFW, aquí no puedo mandarte eso, degenerad@");
        }
    },
};