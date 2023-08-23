module.exports = {
    name: "clima",
    description: "Comprueba un pronóstico del tiempo",
    async execute(message, args){

        if (args.length < 1) {
            message.reply("Por favor proporciona una ubicación para comprobar el clima.");
            return;
        }

        const starts = async function(){

            // var constants = require('../index.js');
            const Discord = require('discord.js');

            const weatherapi = process.env.WEATHERAPI;

            async function getWeather() {
                const fetch = require('node-fetch');
                const response = await fetch("http://api.weatherapi.com/v1/current.json?key="+ weatherapi +"&q=" + args[0] +"&aqi=no&lang=es");
                const data = await response.json();
                const dataWeather = data;
                return dataWeather;
            }

            const data = await getWeather();

            if (data.error){
                message.channel.send(data.error.message);
            }

            const weatherinfo = new Discord.MessageEmbed()

            .setDescription(`**${data.current.condition.text}**`)
            .setAuthor(`Pronóstico del tiempo para ${data.location.name}`)
            .setThumbnail("https:" + data.current.condition.icon)
            .setColor(0x111111)
            // .addField('Timezone', `UTC${location.timezone}`, true)
            .addField('Tipo de grado', 'Celsius', true)
            .addField('Temperatura', `${data.current.temp_c}°`, true)
            // .addField('Viento', data.winddisplay, true)
            .addField('Se siente como', `${data.current.feelslike_c}°`, true)
            .addField('Humedad', `${data.current.humidity}%`, true)

            message.channel.send({ embeds: [weatherinfo] });
        }
        starts();
    }
}
