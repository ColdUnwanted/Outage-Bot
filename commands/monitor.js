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
    This command is not the same as "Status" because status is not being auto updated.
    This is intended for admin user usage because there is no point on having the messages auto update if a normal user request it.
    Aside from that, it will also be memory friendly since it does not need to go through 100 messages because normal user use the command.

    Note:
    This command will also send out a outage notification to the notification channel.
    It will also send a ping to that channel.
    Ensure that the bot has permission to view and send message on that channel.
*/

async function monitor(client, msg, already_alert = false) {
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
                attempts: 3,
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
        .setTitle('Monitor Status')
        .setFooter('Last Updated')
        .setTimestamp();

    // Check if the data file exists, if not create it
    let file = fs.openSync('./data.json', 'a+');
    let file_data = { 'messages': [], 'servers': [] };
    try {
        file_data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        // Do nothing here since its empty
    }

    file = fs.openSync('./data.json', 'w+');

    // Go through all the promises
    for (let i = 0; i < servers.length; i++) {
        const date = new Date();
        const current_time = date.getTime();

        const this_result = result[i];
        const this_server = servers[i];
        let is_down = false;
        let reason = 'Unknown';

        // Put data into file_data first as a default if does not exists
        let has_data = false;

        file_data['servers'].forEach(server => {
            if (server['server'] == this_server.address.toString()) {
                has_data = true;
            }
        });

        if (!has_data) {
            file_data['servers'].push({
                'server': this_server.address.toString(),
                'time': current_time,
                'available': true,
            });
        }

        if (this_server.type.toLowerCase() == 'tcp') {
            // It's tcp
            if (this_result == null) {
                // No idea why this happens, by right this should never happen
                is_down = true;
                reason = 'N/A';
            }
            else if (this_result.status == 'rejected') {
                is_down = true;
                reason = 'Connection Failed';
            }
            else if (this_result.value[0].ping == null) {
                is_down = true;
                reason = 'Timed Out';
            }
            else if (this_result.value[0].ping == 1001) {
                is_down = true;
                reason = 'Port Not Open';
            }

            // Go through all 3 array to see whether there's actually 1 that got through the connection
            if (this_result != null && this_result.status != 'rejected') {
                this_result.value.forEach(result_ping => {
                    if (result_ping.ping != null && result_ping.ping != 1001) {
                        is_down = false;
                        reason = '';
                    }
                });
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
                reason = 'Site Does Not Exist';
            }
            else if (this_result.status == 'rejected' && this_result.reason['response'] == 403) {
                is_down = true;
                reason = 'Forbidden';
            }
            else if (this_result.status == 'rejected') {
                is_down = true;
                reason = 'Timed Out';
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
                reason = 'Connection Failed';
            }
            else if (this_result.value.alive == false) {
                is_down = true;
                reason = 'Timed Out';
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

        let need_to_mention = false;
        if (is_down && this_data.available) {
            if (!already_alert) {
                await send_alert(client, servers[i], reason, true);
            }

            // Update it to unavailable
            this_data.available = false;
            this_data.time = current_time;

            need_to_mention = true;
        }
        else if (!is_down && !this_data.available) {
            const today = new Date();
            const down_date = new Date(this_data.time);
            const date_diff = down_date - today;
            const diff_days = Math.floor(date_diff / 86400000);
            const diff_hours = Math.floor((date_diff % 86400000) / 3600000);
            const diff_mins = Math.round(((date_diff % 86400000) % 3600000) / 60000);

            const string_diff = diff_days + ' days, ' + diff_hours + ' hours, ' + diff_mins + ' minutes';

            if (!already_alert) {
                await send_alert(client, servers[i], string_diff, false);
            }

            // Update it to available
            this_data.available = true;
            this_data.time = current_time;

            need_to_mention = true;
        }

        if (need_to_mention && !already_alert) {
            await send_mention(client);
        }

        // Add the time to the message
        const the_date = new Date(this_data.time);
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

    // Save the data & send the embed
    fs.writeFileSync(file, JSON.stringify(file_data, null, 4));
    fs.closeSync(file);
    await msg.edit({ embeds: [embed] });
}

async function send_alert(client, data, reason, down = false) {
    // Put into try catch method to catch some errors here
    try {
        const channel = await client.channels.fetch(config.alert_channel);

        if (!channel.permissionsFor(client.user.id).has('SEND_MESSAGES')) {
            throw 'Missing Permissions';
        }

        let embed = null;
        if (down) {
            // It's down
            embed = new MessageEmbed()
                .setColor('#ff6961')
                .setTitle(data.name + ' is down!')
                .setTimestamp();

            if (data.hide_address) {
                embed.addField('Address', '*hidden*', false);
            }
            else {
                embed.addField('Address', data.address, false);
            }

            embed.addField('Type', data.type, false);
            embed.addField('Reason', reason, false);
        }
        else {
            // It's up
            embed = new MessageEmbed()
                .setColor('#77DD77')
                .setTitle(data.name + ' is up!')
                .setTimestamp();

            if (data.hide_address) {
                embed.addField('Address', '*hidden*', false);
            }
            else {
                embed.addField('Address', data.address, false);
            }

            embed.addField('Type', data.type, false);
            embed.addField('Downtime', reason, false);
        }

        await channel.send({ embeds: [embed] });
    }
    catch (err) {
        if (err.name == 'DiscordAPIError') {
            console.log(i18n.__mf('monitor.alertFailed', {
                id: config.alert_channel,
            }));
        }
        else if (err == 'Missing Permissions') {
            console.log(i18n.__mf('monitor.alertFailedPerm', {
                id: config.alert_channel,
            }));
        }
        else {
            console.log(err);
        }
    }
}

async function send_mention(client) {
    // Put into try catch method to catch some errors here
    try {
        const channel = await client.channels.fetch(config.alert_channel);

        if (!channel.permissionsFor(client.user.id).has('SEND_MESSAGES')) {
            throw 'Missing Permissions';
        }

        channel.send('<@&' + config.mention_role + '>').then(msg => {
            setTimeout(() => msg.delete(), 3000);
        });
    }
    catch (err) {
        if (err.name == 'DiscordAPIError') {
            console.log(i18n.__mf('monitor.mentionFailed', {
                id: config.alert_channel,
            }));
        }
        else if (err == 'Missing Permissions') {
            console.log(i18n.__mf('monitor.mentionFailedPerm', {
                id: config.alert_channel,
            }));
        }
        else {
            console.log(err);
        }
    }
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
            i18n.__mf('monitor.loadingMessage'),
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
    await monitor(client, msg);

    // Add msg id to the data.json
    let file = fs.openSync('./data.json', 'a+');
    let file_data = { 'messages': [], 'servers': [] };
    try {
        file_data = JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        // Do nothing here since its empty
    }

    file = fs.openSync('./data.json', 'w+');
    if (!file_data.messages.includes([msg.id.toString(), msg.channelId.toString()])) {
        file_data.messages.push([msg.id.toString(), msg.channelId.toString()]);
    }

    // Save the data
    fs.writeFileSync(file, JSON.stringify(file_data, null, 4));
    fs.closeSync(file);
}

module.exports = {
    name: 'monitor',
    description: i18n.__mf('monitor.description'),
    async execute(client, message, args) {
        // Admin only command
        let is_admin = false;
        general.adminId.forEach(admin => {
            if (admin == message.author.id.toString()) {
                is_admin = true;
            }
        });

        if (!is_admin) {
            return;
        }

        await command(client, message, args);
    },
    async auto(client, msg, already_alert = false) {
        await monitor(client, msg, already_alert);
    },
};