module.exports = {
	name: 'randomcat',
	description: 'un gatito random!',
	execute(message, args) {
        // https://dog.ceo/api/breeds/image/random

        const starts = async function(){
            async function getImagesReddit() {
                const fetch = require('node-fetch');
                const response = await fetch(`https://dog.ceo/api/breeds/image/random`);
                const data = await response.json();
                const images = data.message;
                return images;
            }

            const img = await getImagesReddit();
            return message.reply(img);
        }
        starts();

	},
};