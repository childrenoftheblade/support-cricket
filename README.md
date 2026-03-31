# Support Cricket
Support Cricket is a Discord bot that uses private threads ('tickets') to let staff commmunicate with server members without having to go through direct messages.
## Features
- Open tickets through a command or button
- Staff can open tickets for members, instead of having to directly ask them to open a ticket
- Ticket threads are locked when closed but not deleted, making them read-only for future reference
- Set a role to be pinged when a new ticket is opened
- Set a staff role that can manage configuration
- Only pings the other party once the first message is sent, letting you write out an explanation message first
## Setup
1. Clone this repository with `git clone https://github.com/childrenoftheblade/support-crickets.git`
2. Install dependencies with `npm install`
3. Create a `config.json` file with the following content:
```
{
    "token": "YOUR_BOT_TOKEN",
    "clientID": "YOUR_BOT_ID"
}
```
Replace `YOUR_BOT_TOKEN` and `YOUR_BOT_ID` with their respective credentials.

4. Run `node index.js`
## Support
DM me on Discord @childrenoftheblade or create an issue.
