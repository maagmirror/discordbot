module.exports = {
	name: 'pgif',
	description: 'NSFW gifs!',
	execute(message, args) {
        // https://meme-api.herokuapp.com/gimme/porn
        const start = async function(){
            // https://npm.io/package/discord-nsfw
            const Discord = require("discord.js");
            const NSFW = require("discord-nsfw");
            const nsfw = new NSFW();

            const image = await nsfw.pgif();
            return message.reply(image);
        }
        start();
    },
};