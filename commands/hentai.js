'use strict';

const { comandoNsfw } = require('../lib/nsfw');

module.exports = comandoNsfw({
	name: 'hentai',
	description: 'NSFW hentai!',
	metodo: ['hentai', 'lewd'],
});
