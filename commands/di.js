            
const discordTTS=require("discord-tts");
const {Client, Intents} = require("discord.js");
const {AudioPlayer, createAudioResource, StreamType, entersState, VoiceConnectionStatus, joinVoiceChannel} = require("@discordjs/voice");

const intents=
[
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILDS
];

const client = new Client({intents:intents});

module.exports = {
	name: 'di',
	description: 'dice algo',
	execute(message, args) {
        const start = async function(){

            let voiceConnection;
            let audioPlayer=new AudioPlayer();

            const msg = message;

            // if (args[0]){

                const stream=discordTTS.getVoiceStream("Marcelo chupame bien la metalizada concha");
                const audioResource=createAudioResource(stream, {inputType: StreamType.Arbitrary, inlineVolume:true});
                if(!voiceConnection || voiceConnection?.status===VoiceConnectionStatus.Disconnected){
                    voiceConnection = joinVoiceChannel({
                        channelId: msg.member.voice.channelId,
                        guildId: msg.guildId,
                        adapterCreator: msg.guild.voiceAdapterCreator,
                    });
                    // voiceConnection = await entersState(voiceConnection, VoiceConnectionStatus.Connecting, 5_000);
                }
                
                if(voiceConnection.status===VoiceConnectionStatus.Connected){
                    voiceConnection.subscribe(audioPlayer);
                    audioPlayer.play(audioResource);
                }

                // voiceConnection.destroy();
            // }
        }
        start();

	},
};