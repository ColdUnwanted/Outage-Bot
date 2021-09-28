// Get the discord.js classes
const { Collection, Client, Intents } = require('discord.js');
const fs = require('fs');
const { general, monitor } = require('./config.json');
const i18n = require('i18n');
const { join } = require('path');

// Select which token based on whether the bot is testing or not
const token = general.token;

// Create new client instance
const client = new Client({
    disableMentions: 'everyone',
    restTimeOffset: 0,
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILD_BANS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_TYPING,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGE_TYPING,
    ],
});

// il8n config
i18n.configure({
    locales: ['en'],
    directory: join(__dirname, 'locales'),
    defaultLocale: 'en',
    retryInDefaultLocale: true,
    objectNotation: true,
    register: global,

    logErrorFn: function(msg) {
        console.log('error', msg);
    },

    missingKeyFn: function(locale, value) {
        return value;
    },

    mustacheConfig: {
        tags: ['{{', '}}'],
        disable: false,
    },
});

// Client stuffs
client.login(token);
client.commands = new Collection();
client.prefix = general.default_prefix;
client.queue = new Map();
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Load the commands
function readFiles(dir) {
    const paths = fs.readdirSync(dir, { withFileTypes: true });

    return paths.reduce((files, path) => {
        if (path.isDirectory()) {
            files.push(...readFiles(join(dir, path.name)));
        }
        else if (path.isFile()) {
            files.push(join(dir, path.name));
        }

        return files;
    }, []);
}

const commandFiles = readFiles('commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(join(__dirname, file));
    client.commands.set(command.name, command);
}

// Check if the data file permission is ok
let has_perm = true;
fs.access('data.json', fs.constants.R_OK | fs.constants.W_OK, (err) => {
    if (err) {
        has_perm = false;
    }
});

if (!has_perm) {
    // Log it and stop all commmands from working
    console.log('data.json is missing read or write permissions. Please ensure that the file has the permission as it is needed for monitor and status to run.');
}

// When client is ready print out the bot details
client.once('ready', () => {
    // Display a ui
    console.log('Logged in as');
    console.log(client.user.username);
    console.log(client.user.id);
    console.log('----------');

    // Set bot activity
    client.user.setPresence({ activities: [{ name: general.status, type: 'WATCHING' }], status: 'online' });

    // Run monitor refresh
    (async () => {
        while (has_perm) {
            let file = fs.openSync('data.json', 'a+');
            let file_data = { 'messages': [], 'servers': [] };
            try {
                file_data = JSON.parse(fs.readFileSync(file, 'utf8'));
            }
            catch {
                // Do nothing here since its empty
            }

            const run_data = JSON.parse(JSON.stringify(file_data));

            let already_alert = false;
            for (let i = 0; i < run_data.messages.length; i++) {
                file = fs.openSync('./data.json', 'w+');
                // Get the channel & message
                // This is because you can't fetch message without client
                const message = run_data.messages[i];
                let msg = null;
                try {
                    const channel = client.channels.cache.get(message[1].toString());
                    msg = await channel.messages.fetch(message[0].toString());

                    if (msg == null) {
                        throw 'Message Could Not Be Found!';
                    }
                }
                catch (e) {
                    file_data.messages.splice(i, 1);

                    if (e.name == 'DiscordAPIError') {
                        console.log('Unknown Message, Removing From List - ' + message[0].toString());
                    }
                }

                fs.writeFileSync(file, JSON.stringify(file_data, null, 4));
                fs.closeSync(file);
                // Edit the message
                if (msg != null) {
                    await client.commands.get('monitor').auto(client, msg, already_alert);
                    already_alert = true;
                }
            }

            const ms_from_s = monitor.update_rate * 1000;
            const wait_ms = ms_from_s - new Date().getTime() % ms_from_s;
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            await delay(wait_ms);
        }
    })();
});

// Get commands call
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // For now use the default prefix
    const prefix = general.prefix;

    // Check if prefix match
    const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(prefix)})\\s*`);
    if (!prefixRegex.test(message.content)) return;

    const [, matchedPrefix] = message.content.match(prefixRegex);

    // Get the arguements
    const args = message.content.slice(matchedPrefix.length).trim().split(' ');
    const command_name = args.shift().toLowerCase();

    // Try to find the command
    const command =
        client.commands.get(command_name) ||
        client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(command_name));

    if (!command) return;

    // Block commands if does not have perm for the file
    if (!has_perm) {
        return;
    }

    // Try to run the commmand
    try {
        await command.execute(client, message, args);
    }
    catch (error) {
        console.error(error);
        message.reply('An error occured');
    }
});