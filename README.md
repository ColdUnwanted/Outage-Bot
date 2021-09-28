# Outage-Bot
A open source Discord bot coded in JavaScript with [Discord.js](https://discord.js.org).\n
Services are monitor with either TCP ping, http request or IMCP ping.

## Installation
### Linux
1. Make sure you have installed [Node.js](https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-debian-9) v10 or higher and [Git](https://www.linode.com/docs/development/version-control/how-to-install-git-on-linux-mac-and-windows/).
2. Clone this repository with `https://github.com/ColdUnwanted/Outage-Bot.git`.
3. Run `cd Outage-Bot` to move in the folder that Git has just created.
4. Run `npm install` to download the node modules required.
5. Rename `config_example.json` to `config.json` and edit it.
6. Run the bot with `node bot.js`.

### Windows
1. Make sure you have installed [Node.js](https://www.guru99.com/download-install-node-js.html) v10 or higher and [Git](https://www.linode.com/docs/development/version-control/how-to-install-git-on-linux-mac-and-windows/).
2. Clone this repository with `https://github.com/ColdUnwanted/Outage-Bot.git`.
3. Run `cd Outage-Bot` to move in the folder that Git has just created.
4. Run `npm install` to download the node modules required.
5. Rename `config_example.json` to `config.json` and edit it.
6. Run the bot with `node bot.js`.

### Bot Setup
Rename `config_example.json` to `config.json` and edit the default value
* `token` - Discord bot [token](https://www.writebots.com/discord-bot-token/)
* `prefix` - Discord bot prefix
* `status` - Text for bot status
* `adminId` - List of IDs that can use the monitor command
* `timeout` - How many seconds before a ping or HTTP request is timed out
* `alert_channel` - Channel where the up and down notification will be sent
* `mention_role` - Role to mention when the up and down notification is sent
* `update_rate` - Seconds to update monitor messages

## Server Configuration
Servers should be setup similar to the examples already in `server.json`
```
[
    {
        "name": "DuckDuckGo",
        "type": "http",
        "address": "duckduckgo.com",
        "hide_address": false
    },
    {
        "name": "Google DNS",
        "type": "ping",
        "address": "8.8.8.8",
        "hide_address": false
    },
    {
        "name": "Gmail SMTP",
        "type": "tcp",
        "address": "smtp.gmail.com:465",
        "hide_address": false
    }
]
```

## Commands
Default prefix: `>`
* `ping` - Get the bot's ping to discord
* `uptime` - Get the bot's uptime
* `status` - Display the status of all servers
* `monitor` - Display an updating monitor of the servers' status