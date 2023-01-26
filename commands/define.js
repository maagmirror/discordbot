module.exports = {
	name: 'define',
	description: 'maggy define contrato, de momento solo define cosas en ingles',
	execute(message, args) {

        var query = args[0];

        const wiki = require('wikipedia');


        const starts = async function(){

            async function getDefinition() {
                try {
                    const page = await wiki.page(query);
                    //Response of type @Page object
                    var summary = await page.summary();

                    // console.log(summary.extract);
                    return summary.extract;
                    //Response of type @wikiSummary - contains the intro and the main image
                } catch (error) {
                    return error;
                    //=> Typeof wikiError
                }
            }

            const data = await getDefinition();

            message.reply(data);
        }

        starts();

        // return message.reply('ta roto este comando capo, no preguntes que me pongo tiste :c' + '\n' + 'https://c.tenor.com/qzidRKHIauwAAAAd/tas-tiste-emilia-mernes.gif');
    }
};
