module.exports = {
	name: 'pimg',
	description: 'NSFW images!',
	execute(message, args) {
        // https://meme-api.herokuapp.com/gimme/porn
        const starts = async function(){
            async function getImagesReddit() {
                const fetch = require('node-fetch');
                const response = await fetch(`https://meme-api.herokuapp.com/gimme/porn`);
                const data = await response.json();
                const images = data.url;
                return images;
            }

            const img = await getImagesReddit();
            return message.reply(img);
        }
        starts();
    },
};