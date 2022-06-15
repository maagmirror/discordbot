

module.exports = {
    name: "clima",
    description: "Comprueba un pronóstico del tiempo",
    async execute(message, args){

        const weather = require('weather-js');
        const Discord = require('discord.js');

        weather.find({search: args[0] + args[1] + args[2] + args[3], degreeType: 'C'}, function (error, result){
            // 'C' can be changed to 'F' for farneheit results
            if(error) return message.channel.send(error);
            // if(!args[0]) return message.channel.send('Please specify a location')

            if(result === undefined || result.length === 0) return message.channel.send('**Invalido** no existe ese lugar');

            var current = result[0].current;
            var location = result[0].location;

            const weatherinfo = new Discord.MessageEmbed()
            .setDescription(`**${current.skytext}**`)
            .setAuthor(`Pronóstico del tiempo para ${current.observationpoint}`)
            .setThumbnail(current.imageUrl)
            .setColor(0x111111)
            .addField('Timezone', `UTC${location.timezone}`, true)
            .addField('Degree Type', 'Celsius', true)
            .addField('Temperatura', `${current.temperature}°`, true)
            .addField('Viento', current.winddisplay, true)
            .addField('Se siente como', `${current.feelslike}°`, true)
            .addField('Humedad', `${current.humidity}%`, true)


            message.channel.send({ embeds: [weatherinfo] });
        });     
    }
}