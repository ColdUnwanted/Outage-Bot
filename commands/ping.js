const { MessageEmbed } = require('discord.js');
const i18n = require('i18n');

/*
    Summary:
    A command that will show the ping to Discord's API & their websocket.
    Purpose of this is just to know how's the ping like.
*/

async function command(client, message, args, interaction = false) {
    // Get the user, this will standardize between interaction user and message users
    let user = null;
    if (interaction) {
        user = message.user;
    }
    else {
        user = message.author;
    }

    // Send the initial ping embed, this is 2 part because we need to know how the api speed on how long it takes the message to send
    const embed = new MessageEmbed()
        .setColor('#2f3136')
        .setDescription(
            i18n.__mf('ping.message', {
                websocket: Math.round(message.client.ws.ping) + 'ms',
                api: 'Testing...',
            }),
        )
        .setAuthor(
            user.tag,
            user.avatarURL(),
        )
        .setTimestamp();

    // Get the api start and end time
    let date = new Date();
    const start_time = date.getTime();
    const msg = await message
        .reply({ embeds: [embed], allowedMentions: { repliedUser: false } })
        .catch(console.error);

    date = new Date();
    const end_time = date.getTime();

    // Edit the msg to add the api
    embed.setDescription(
        i18n.__mf('ping.message', {
            websocket: Math.round(message.client.ws.ping) + 'ms',
            api: Math.round((end_time - start_time)) + 'ms',
        }),
    );

    if (interaction) {
        await message.editReply({ embeds: [embed] });
    }
    else {
        await msg.edit({ embeds: [embed] });
    }
}

module.exports = {
    name: 'ping',
    description: i18n.__mf('ping.description'),
    async execute(client, message, args) {
        await command(client, message, args);
    },
};