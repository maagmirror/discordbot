'use strict';

const { OAuth2Scopes, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const PERMISOS = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.EmbedLinks,
	PermissionFlagsBits.AttachFiles,
	PermissionFlagsBits.ReadMessageHistory,
	PermissionFlagsBits.AddReactions,
	PermissionFlagsBits.Connect,
	PermissionFlagsBits.Speak,
];

module.exports = {
	name: 'invite',
	description: 'te paso el link para sumarme a otro servidor',
	async run(ctx) {
		// Se arma con el id de la propia aplicación, así no queda hardcodeado.
		const url = ctx.client.generateInvite({
			scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
			permissions: PERMISOS,
		});

		const embed = new EmbedBuilder()
			.setTitle('Sumame a tu servidor')
			.setColor(0x5865f2)
			.setDescription(`[Hacé click acá para invitarme](${url})`)
			.addFields({
				name: 'Permisos que pido',
				value:
					'Ver canales, enviar mensajes, insertar enlaces, adjuntar archivos, ' +
					'leer historial, reaccionar, y conectarme y hablar en canales de voz.',
			})
			.setFooter({ text: 'Necesitás "Gestionar servidor" en el server destino.' });

		await ctx.reply({ embeds: [embed] });
	},
};
