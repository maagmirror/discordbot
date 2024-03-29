module.exports = {
	name: 'help',
	description: 'Muestra los comandos disponibles!',
	execute(message, args) {
        const fs = require('fs');
        const path = require('path');
		const commandFiles = fs.readdirSync(path.join(__dirname)).filter(file => file.endsWith('.js'));
        
        let comandos = "";
        
        for (const file of commandFiles) {
            const command = require(`../commands/${file}`);
            // message.channel.send("Maggy " + command.name + " Descripción: " + command.description);
            comandos = comandos + ("`maggy " + command.name + "`" + " - " + command.description + "\n");
        }

        message.author.send(comandos).catch(error => {
            message.channel.send("No puedo responderte al privado :c");
            message.reply(comandos);
        });
        
        message.reply("Te respondí al privado UwU");
	},
};
