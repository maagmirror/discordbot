// https://v2.jokeapi.dev/joke/Any?lang=es

const https = require('https');
const Discord = require('discord.js');

module.exports = {
    name: 'chiste',
    description: 'Cuenta un chiste',
    // usage: 'maggy chiste',
    execute(message, args) {

        const starts = async function(){
            async function getJokes() {
                const fetch = require('node-fetch');
                const response = await fetch(`https://v2.jokeapi.dev/joke/Any?lang=es`);
                const data = await response.json();

                let joke = "";

                if (data.type == "single"){
                    joke = data.joke;
                }else{
                    joke = data.setup;
                    joke = joke + ("\n" + data.delivery);
                }

                return joke;
            }

            const jajas = await getJokes();
            return message.reply(jajas);
        }
        starts();
    },
}