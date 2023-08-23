var colors = require('colors');
const fs = require('fs');
const Discord = require('discord.js');
const { Client, Intents, Attachment, Message, MessageEmbed } = require("discord.js");

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

	if (message.content.startsWith(prefix)) {
		console.log("[MENSAJE]".green + "[".green + message.guild.name.green + "] ".green + (message.author.username).blue + ": " + message.content);
	}

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const command = args.shift().toLowerCase();

	const pendingResponses = {};
	const collectorTimeout = 30000; // Tiempo de espera para la respuesta del usuario en milisegundos

	if (!client.commands.has(command)) {
		// Obtén el contenido del mensaje sin el prefijo
		const messageContentWithoutPrefix = message.content.slice(prefix.length);

		// Lee el archivo existente (si existe)
		let existingData = '';
		try {
			existingData = fs.readFileSync('mensajes.txt', 'utf8');
		} catch (error) {
			console.error('Error al leer el archivo:', error);
		}

		if (!existingData.includes(`pregunta: '${messageContentWithoutPrefix}'`)) {
			// Si el bot no tiene una respuesta, pregunta cómo debería responder
			message.channel.send('No tengo una respuesta guardada para eso. ¿Cómo debería responder a esta pregunta?')
				.then(responsePrompt => {
					// Espera la respuesta del usuario
					const filter = response => response.author.id === message.author.id && !response.author.bot;
					const collector = message.channel.createMessageCollector(filter, { time: collectorTimeout });

					collector.on('collect', (userResponse) => {
						const responseContent = userResponse.content;

						// Remover todas las instancias del prefijo en la respuesta
						const cleanResponse = responseContent.replace(new RegExp(`${prefix}`, 'g'), '').trim();

						// Verificar si la respuesta contiene el prefijo
						if (responseContent.includes(prefix) || cleanResponse === '') {
							userResponse.reply('Esa respuesta está mal y no será guardada.');
							collector.stop();
							return;
						} else {
							// Guardar la pregunta y la respuesta en el archivo
							const formattedEntry = `pregunta: '${messageContentWithoutPrefix}' respuesta: '${cleanResponse}'\n`;
							fs.appendFile('mensajes.txt', formattedEntry, (err) => {
								if (err) {
									console.error('Error al guardar el mensaje:', err);
								}
							});

							// Guardar la respuesta del usuario en pendingResponses
							pendingResponses[messageContentWithoutPrefix] = cleanResponse;

							// Borra el mensaje de la pregunta original
							responsePrompt.delete();

							// Envía un mensaje de confirmación al usuario
							userResponse.reply('¡Gracias por la respuesta! La guardaré para la próxima vez.');
							collector.stop();
						}

					});

					collector.on('end', (collected, reason) => {
						if (reason === 'time') {
							message.channel.send('Tiempo agotado. No se recibió respuesta :c');
							// Borra el mensaje de la pregunta original si el tiempo se agota
							responsePrompt.delete();
						}
					});
				});
		} else {
			if (!existingData.includes(`pregunta: '${messageContentWithoutPrefix}'`)) {
				// ... (código que maneja la interacción inicial)
			} else {
				const questionStart = existingData.indexOf(`pregunta: '${messageContentWithoutPrefix}'`);
				const responseStart = existingData.indexOf("respuesta: '", questionStart) + 12;
				const responseEnd = existingData.indexOf("'", responseStart);
				const savedResponse = existingData.slice(responseStart, responseEnd);

				if (pendingResponses[messageContentWithoutPrefix]) {
					// Si hay una respuesta pendiente, envíala
					message.channel.send(pendingResponses[messageContentWithoutPrefix]);
				} else if (savedResponse && !savedResponse.includes("No tengo una respuesta guardada para eso.")) {
					// Si hay una respuesta guardada válida, envíala
					message.channel.send(savedResponse);
				} else {
					// No hay respuesta pendiente ni guardada, crea una
					message.channel.send('Lo siento, no tengo respuestas en este momento.');
				}
			}

		}

		return;
	}

	try {
		client.commands.get(command).execute(message, args);
	} catch (error) {
		console.error(error);
	}
});

client.login(process.env.DISCORD_TOKEN);
