'use strict';

const { comandoNsfw } = require('../lib/nsfw');

module.exports = comandoNsfw({
	name: 'pimg',
	description: 'NSFW images!',
	metodo: ['gonewild', 'fourk'],
});
