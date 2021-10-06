const { MessageEmbed } = require('discord.js');
const i18n = require('i18n');
const { monitor: config, general } = require('../config.json');
const servers = require('../servers.json');
const nodejsTcpPing = require('nodejs-tcp-ping');
const axios = require('axios');
const ping = require('ping');
const fs = require('fs');

/*
    Summary:
    A command that will show the status of the servers.
    This command is not the same as "Monitor" because monitor is auto updated while this just shows the current.
    This is intended for normal user usage.
*/

async function status(client, user, msg) {
    // Promise array, this will store everything that needs to be ran
    const all_promise = [];

    // Go though the server lists
    servers.forEach(server => {
        if (server.type.toLowerCase() == 'tcp') {
            // TCP
            // This will be using the tcp-ping module
            // Address should be in 2 part
            const split_address = server.address.split(':');
            const address = split_address[0];
            let port = 80;

            if (split_address.length > 1) {
                // Port numbered specified so use it
                port = split_address[1];
            }

            const promise = nodejsTcpPing.tcpPing({
                host: address,
                port: port,
                timeout: config.timeout * 1000,
                attempts: 1,
            });

            all_promise.push(promise);
        }
        else if (server.type.toLowerCase() == 'http') {
            // HTTP
            // This will be using axios
            let address = server.address;

            // Make sure there's either http or https in the front
            if (!address.startsWith('https') && !address.startsWith('http')) {
                address = 'https://' + address;
            }

            const promise = axios.get(address, {
                timeout: config.timeout * 1000,
            });
            all_promise.push(promise);
        }
        else {
            // Ping
            // This will be using nodejs ping
            const address = server.address;

            const promise = ping.promise.probe(address, {
                timeout: config.timeout,
            });

            all_promise.push(promise);
        }
    });

    // Run all promise
    const result = await Promise.allSettled(all_promise);

    // Create the embed first
    const embed = new MessageEmbed()
        .setColor('#2f3136')
        .setTitle('Status')
        .setAuthor(
            user.tag,
            user.avatarURL(),
        )
        .setTimestamp();

    // Check if the data file exists, if not create it
    const file = fs.openSync('./data.json', 'a+');
    let file_data = { 'messages': [], 'servers': [] };
    try {
        file_data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        // Do nothing here since its empty
    }
    fs.close(file);

    // Go through all the promises
    for (let i = 0; i < servers.length; i++) {
        const this_result = result[i];
        const this_server = servers[i];
        let is_down = false;

        // Put data into file_data first as a default if does not exists
        if (this_server.type.toLowerCase() == 'tcp') {
            // It's tcp
            if (this_result == null) {
                // No idea why this happens, by right this should never happen
                is_down = true;
            }
            else if (this_result.status == 'rejected') {
                is_down = true;
            }
            else if (this_result.value[0].ping == null) {
                is_down = true;
            }
            else if (this_result.value[0].ping == 1001) {
                is_down = true;
            }
        }
        else if (this_server.type.toLowerCase() == 'http') {
            // It's http
            if (this_result == null) {
                // No idea why this happens, by right this should never happen
                is_down = true;
            }
            else if (this_result.status == 'rejected' && this_result.reason['code'] == 'ENOTFOUND') {
                is_down = true;
            }
            else if (this_result.status == 'rejected' && this_result.reason['response'] == 403) {
                is_down = true;
            }
            else if (this_result.status == 'rejected') {
                is_down = true;
            }
        }
        else {
            // It's ping
            if (this_result == null) {
                // No idea why this happens, by right this should never happen
                is_down = true;
            }
            else if (this_result.status == 'rejected') {
                is_down = true;
            }
            else if (this_result.value.alive == false) {
                is_down = true;
            }
        }

        let data = '';
        if (is_down) {
            data = '🔴';
        }
        else {
            data = '🟢';
        }

        if (this_server.hide_address) {
            data += ' *hidden*';
        }
        else {
            data += ' ' + this_server.address;
        }

        // Find current data
        let this_data = null;
        file_data['servers'].forEach(server => {
            if (server['server'] == this_server.address.toString()) {
                this_data = server;
            }
        });

        // By right this_data should not be null
        if (this_data == null) {
            // This should never happen but incase it does
            // log it
        }

        // Add the time to the message
        const date = new Date();
        let time = date.getTime();
        if (this_data != null && this_data.time != null) {
            time = this_data.time;
        }

        const the_date = new Date(time);
        const string_date = the_date.getDate() +
        '/' + (the_date.getMonth() + 1) +
        '/' + the_date.getFullYear() +
        ' ' + the_date.getHours() +
        ':' + the_date.getMinutes() +
        ':' + the_date.getSeconds();

        if (is_down) {
            data += ' (Down Since: ``' + string_date + '``)';
        }
        else {
            data += ' (Up Since: ``' + string_date + '``)';
        }

        // Add the embed
        embed.addField(this_server.name, data, false);
    }

    await msg.edit({ embeds: [embed] });
}

async function command(client, message, args, interaction = false) {
    // Get the user, this will standardize between interaction user and message users
    let user = null;
    if (interaction) {
        user = message.user;
    }
    else {
        user = message.author;
    }

    // Generate the embed to show that the monitor is loading
    const embed = new MessageEmbed()
        .setColor('#2f3136')
        .setDescription(
            i18n.__mf('status.loadingMessage'),
        )
        .setAuthor(
            user.tag,
            user.avatarURL(),
        )
        .setTimestamp();

    let msg = await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

    // This could happen because the message is from interaction
    if (msg == null) {
        msg = await message.fetchReply();
    }

    // Send it to the other function
    await status(client, user, msg);
}

module.exports = {
    name: 'status',
    description: i18n.__mf('status.description'),
    async execute(client, message, args) {
        await command(client, message, args);
    },
};