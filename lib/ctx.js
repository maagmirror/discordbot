'use strict';

const { ChannelType, MessageFlags } = require('discord.js');

const MAX_CONTENT = 2000;

function toPayload(input) {
	const payload = typeof input === 'string' ? { content: input } : { ...input };

	if (typeof payload.content === 'string' && payload.content.length > MAX_CONTENT) {
		payload.content = `${payload.content.slice(0, MAX_CONTENT - 1)}…`;
	}

	return payload;
}

function isNsfwChannel(channel) {
	if (!channel) return false;
	if (channel.nsfw === true) return true;
	// En un hilo el flag NSFW vive en el canal padre.
	if (channel.isThread?.()) return channel.parent?.nsfw === true;
	return false;
}

function isDm(channel) {
	return channel?.type === ChannelType.DM;
}

class Ctx {
	constructor({ client, message = null, interaction = null, args = [], command }) {
		this.client = client;
		this.message = message;
		this.interaction = interaction;
		this.command = command;
		this.args = args;
		this.isSlash = Boolean(interaction);

		const source = interaction ?? message;
		this.channel = source.channel;
		this.guild = source.guild;
		this.member = source.member;
		this.user = interaction ? interaction.user : message.author;

		this._replied = false;
		this._deferred = false;
	}

	get isNsfw() {
		return isNsfwChannel(this.channel);
	}

	get isDm() {
		return isDm(this.channel);
	}

	arg(name) {
		if (this.isSlash) {
			const value = this.interaction.options.get(name)?.value;
			return value === undefined || value === null ? null : String(value);
		}

		const defs = this.command?.options ?? [];
		const index = defs.findIndex((option) => option.name === name);
		if (index === -1) return this.args[0] ?? null;

		if (defs[index].rest) {
			const rest = this.args.slice(index).join(' ').trim();
			return rest === '' ? null : rest;
		}

		return this.args[index] ?? null;
	}

	async defer({ ephemeral = false } = {}) {
		if (!this.isSlash || this._deferred || this._replied) return;
		await this.interaction.deferReply(
			ephemeral ? { flags: MessageFlags.Ephemeral } : {},
		);
		this._deferred = true;
	}

	async reply(input) {
		const payload = toPayload(input);

		if (this.isSlash) {
			if (this._deferred && !this._replied) {
				this._replied = true;
				return this.interaction.editReply(payload);
			}
			if (this._replied) return this.interaction.followUp(payload);
			this._replied = true;
			return this.interaction.reply(payload);
		}

		this._replied = true;
		return this.message.reply({
			...payload,
			allowedMentions: { repliedUser: true },
		});
	}

	async send(input) {
		const payload = toPayload(input);
		if (this.isSlash) return this.reply(payload);
		return this.channel.send(payload);
	}

	async react(emoji) {
		if (this.isSlash) return null;
		try {
			return await this.message.react(emoji);
		} catch {
			return null;
		}
	}

	async dm(input) {
		try {
			await this.user.send(toPayload(input));
			return true;
		} catch {
			return false;
		}
	}
}

module.exports = { Ctx, toPayload, isNsfwChannel, MAX_CONTENT };
