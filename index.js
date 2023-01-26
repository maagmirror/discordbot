var colors = require('colors');
const fs = require('fs');
const Discord = require('discord.js');
const { Client, Intents, Attachment, Message, MessageEmbed } = require("discord.js");

module.exports = Object.freeze({
    weatherapikey: 'yourapikeyhere'
});

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

client.on('ready', () => {
  client.user.setActivity(`Generar Bugs en ${client.guilds.cache.size} servidores `, { type: "PLAYING" })
  console.log(`Logged in as`, `${client.user.tag}`);
})

client.on("guildCreate", guild => {
	guild.owner.send('Gracias! Puedes usar maggy help para descubrir mis comandos.')
});

client.commands = new Discord.Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	// set a new item in the Collection
	// with the key as the command name and the value as the exported module
	client.commands.set(command.name, command);
}

// Setup our environment variables via dotenv
require('dotenv').config()

// Set the prefix
let prefix = process.env.PREFIX;

client.on('message', message => {

	//if requester is a bot or no start with prefix
	//and get the prefix in lowercase
	if (!message.content.toLowerCase().startsWith(prefix.toLowerCase()) || message.author.bot) return;
	
	if (message.content.startsWith(prefix)){
		console.log("[MENSAJE]".green + "[".green + message.guild.name.green +"] ".green + (message.author.username).blue + ": " + message.content);
	}

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();

	if (!client.commands.has(command)){
		message.reply('Disculpá, pero ese comando no existe!');
		return
	};

	try {
		client.commands.get(command).execute(message, args);
	} catch (error) {
		console.error(error); 
	}
});

client.login(process.env.DISCORD_TOKEN);
