'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'respuestas.json');
const LEGACY_PATH = path.join(__dirname, '..', 'mensajes.txt');

class Respuestas {
	constructor() {
		this.map = new Map();
		this.loaded = false;
	}

	static normalize(question) {
		return String(question).trim().toLowerCase().replace(/\s+/g, ' ');
	}

	load() {
		if (this.loaded) return this;

		fs.mkdirSync(DATA_DIR, { recursive: true });

		if (fs.existsSync(STORE_PATH)) {
			try {
				const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
				for (const [key, value] of Object.entries(raw)) this.map.set(key, value);
			} catch (error) {
				console.error('[respuestas] JSON invalido, arranco vacio:', error.message);
			}
		} else if (fs.existsSync(LEGACY_PATH)) {
			this.migrateLegacy();
		}

		this.loaded = true;
		return this;
	}

	migrateLegacy() {
		let migrated = 0;
		try {
			const text = fs.readFileSync(LEGACY_PATH, 'utf8');
			const pattern = /pregunta:\s*'([^']*)'\s*respuesta:\s*'([^']*)'/g;
			let match;
			while ((match = pattern.exec(text)) !== null) {
				const [, question, answer] = match;
				if (!question.trim() || !answer.trim()) continue;
				this.map.set(Respuestas.normalize(question), answer.trim());
				migrated += 1;
			}
		} catch (error) {
			console.error('[respuestas] no pude leer mensajes.txt:', error.message);
			return;
		}

		if (migrated > 0) {
			this.persistSync();
			console.log(`[respuestas] migradas ${migrated} desde mensajes.txt`);
		}
	}

	get(question) {
		return this.map.get(Respuestas.normalize(question)) ?? null;
	}

	has(question) {
		return this.map.has(Respuestas.normalize(question));
	}

	async set(question, answer) {
		this.map.set(Respuestas.normalize(question), answer);
		await this.persist();
	}

	get size() {
		return this.map.size;
	}

	toJSON() {
		return Object.fromEntries(this.map);
	}

	persistSync() {
		fs.mkdirSync(DATA_DIR, { recursive: true });
		fs.writeFileSync(STORE_PATH, JSON.stringify(this.toJSON(), null, 2), 'utf8');
	}

	async persist() {
		try {
			await fsp.mkdir(DATA_DIR, { recursive: true });
			await fsp.writeFile(STORE_PATH, JSON.stringify(this.toJSON(), null, 2), 'utf8');
		} catch (error) {
			console.error('[respuestas] no pude guardar:', error.message);
		}
	}
}

module.exports = new Respuestas();
