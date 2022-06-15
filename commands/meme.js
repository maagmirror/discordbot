const https = require('https');
const Discord = require('discord.js');
// const url = 'https://www.reddit.com/r/Republica_Argentina/hot/.json?limit=100'

module.exports = {
    name: 'meme',
    description: 'Un memardo nuevo (ahora si en español c:)',
    execute(message, args) {

        const starts = async function(){
            async function getImagesReddit() {
                const fetch = require('node-fetch');
                const response = await fetch(`https://meme-api.herokuapp.com/gimme/Divertido`);
                const data = await response.json();
                const images = data.url;
                return images;
            }

            const img = await getImagesReddit();
            return message.reply(img);
        }
        starts();
    },
}