const { REST, Routes, MessageFlags, Client, Events, GatewayIntentBits, SlashCommandBuilder, ThreadAutoArchiveDuration, ChannelType, ButtonBuilder, ActionRowBuilder, ButtonStyle, FileComponent, PermissionsBitField } = require('discord.js');
const { clientID, token } = require('./config.json');
const { TicketChannel, PingRole, StaffRole } = require('./database.js');

const commands = [
  new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Ticket Commands')
        .addSubcommand(subcommand =>
          subcommand
            .setName('open')
            .setDescription('Open a ticket with server staff')
            .addUserOption(option =>
              option.setName('user')
                .setDescription('Open a ticket for another user (staff only)')
                .setRequired(false)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('channel')
            .setDescription('Set the channel where ticket threads are created and the create ticket button is sent')
            .addChannelOption(option =>
              option.setName('channel')
              .setDescription('The channel to use for tickets')
              .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('ping')
            .setDescription('Set the role to be pinged when a ticket is opened')
            .addRoleOption(option =>
              option.setName('role')
              .setDescription('The role to ping')
              .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('staff')
            .setDescription('Set the role that can use staff-only commands')
            .addRoleOption(option =>
              option.setName('role')
              .setDescription('The role to set as staff')
              .setRequired(true)))
        .addSubcommand(subcommand =>
          subcommand
            .setName('config')
            .setDescription('View Support Cricket configuration'))
        .addSubcommand(subcommand =>
          subcommand
            .setName('close')
            .setDescription('Close a ticket and make it read only'))
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Registering slash commands...');
            await rest.put(
                Routes.applicationCommands(clientID),
                { body: commands }
            );        
        console.log('Slash commands registered!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
};

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {

      const subCommand = interaction.options.getSubcommand();
      
      try {
          switch (subCommand) {
              case 'open':
                  await cmdOpen(interaction);
                  break;
              case 'channel':
                  await cmdChannel(interaction);
                  break;
              case 'ping':
                await cmdPing(interaction);
                break;
              case 'staff':
                await cmdStaff(interaction);
                break;
              case 'config':
                await cmdConfig(interaction);
                break;
              case 'close':
                await cmdClose(interaction);
                break;
              default:
                  await interaction.reply({ content: 'Unknown subcommand!', flags: MessageFlags.Ephemeral });
          }} catch (error) {
            console.error(`Error handling ${subCommand}:`, error);
            const reply = interaction.replied || interaction.deferred
                ? interaction.followUp.bind(interaction)
                : interaction.reply.bind(interaction);
            await reply({ content: `Error: ${error.message}`, flags: MessageFlags.Ephemeral });
            }
    } else {
      if (interaction.isButton()) {
        btnCmdOpenTicket(interaction, interaction.user);
      }
    }
});

// For pinging when the first message is sent

const ticketMonitor = new Set();
client.on('messageCreate', async message => {
  // Ignore bot messages
  if (message.author.bot) return;
  // Only handle messages in private threads
  if (!message.channel.isThread() || message.channel.type !== ChannelType.PrivateThread) return;
  // Only notify once per thread
  if (ticketMonitor.has(message.channel.id)) return;

  // Check if this thread's parent channel is the configured ticket channel
  const ticketChannelConfig = await TicketChannel.findOne({ where: { server: message.guild.id } });
  if (!ticketChannelConfig || message.channel.parentId !== ticketChannelConfig.channelId) return;

  const pingRoleConfig = await PingRole.findOne({ where: { server: message.guild.id } });
  if (pingRoleConfig) {
    ticketName = message.channel.name.split('-');
    ticketMonitor.add(message.channel.id);
    if (ticketName[4] == 'm') {
      // If ticket is member opened
      await message.channel.send(`<@&${pingRoleConfig.roleId}>, a new ticket message has been received.`);
    } else {
      // If ticket is staff opened
      await message.channel.send(`<@${ticketName[5]}>, you have been added to this ticket so staff can communicate privately with you.`);
    }
  }
});

// Permissions checking

async function hasStaffRole(interaction) {
  const staffCheckRole = await StaffRole.findOne({ where: { server: interaction.member.guild.id } });
  const staffCheckRoleId = staffCheckRole?.roleId;
  // Check if the user has the staff role or is an administrator
  const permissions = new PermissionsBitField(interaction.member.permissions);
  if ((staffCheckRoleId && interaction.member.roles.cache.has(staffCheckRoleId)) || permissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  } 
  return false;
}

// Thread creation

async function openTicket(interaction, user, channel, isoDateOnly, ticketType) {
      thread = await channel.threads.create({
      name: `${user.username}-${isoDateOnly}-${ticketType}-${user.id}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    	type: ChannelType.PrivateThread, 
      reason: 'Opening support ticket for user'
    });
    const pingRoleConfig = await PingRole.findOne({ where: { server: interaction.member.guild.id } });
    if (ticketType == 'm') {
      if (pingRoleConfig) {
        await thread.send(`<@${user.id}>, thank you for contacting server staff! Let them know why you've opened a ticket and they'll get back to you as soon as possible. **Once you send a message, a ping will be sent to notify them.**`)
      } else {
        await thread.send(`Thank you for contacting server staff! Let them know why you've opened a ticket and they'll get back to you as soon as possible.`)
      }
   } else {
    await thread.send(`<@&${pingRoleConfig.roleId}>, this ticket has been opened for ${user.username}. **Once you send a message, they will be added to the thread and notified.**`)
   }
    interaction.reply({ content: `Support Cricket has opened a ticket for you. View it here: ${thread}`, flags: MessageFlags.Ephemeral })
}

// ticket config

async function cmdConfig(interaction) {
  if (!await hasStaffRole(interaction)) {
    return interaction.reply({
      content: 'You need admin permissions or the set staff role to view Support Cricket configuration.',
      flags: MessageFlags.Ephemeral
    });
  }
  const ticketChannelConfig = await TicketChannel.findOne({ where: { server: interaction.member.guild.id } });
  const pingRoleConfig = await PingRole.findOne({ where: { server: interaction.member.guild.id } });
  const staffRoleConfig = await StaffRole.findOne({ where: { server: interaction.member.guild.id } });
  const pingRoleDisplay = pingRoleConfig ? `<@&${pingRoleConfig.roleId}>` : 'Required but not set';
  const ticketChannelDisplay = ticketChannelConfig ? `<#${ticketChannelConfig.channelId}>` : 'Required but not set';
  const staffRoleDisplay = staffRoleConfig ? `<@&${staffRoleConfig.roleId}>` : 'Not set';
  await interaction.reply({
    content: `## Support Cricket Configuration\nPing Role: ${pingRoleDisplay}\nTicket Channel: ${ticketChannelDisplay}\nStaff Role: ${staffRoleDisplay}`,
    flags: MessageFlags.Ephemeral
  });
}

// ticket ping

async function cmdPing(interaction) {
    if (!await hasStaffRole(interaction)) {
      return interaction.reply({ 
        content: 'You need admin permissions or the set staff role to set the ping role.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  const pingRoleConfig = interaction.options.getRole('role', true)
  const pingRoleOld = await PingRole.findOne();
  if (pingRoleOld || !pingRoleConfig) {
    try {
      PingRole.destroy({ where: { server: interaction.member.guild.id } });
    } catch (error) {
      console.error('Error removing previous ping role from configuration:', error)
    }
  }
  if (pingRoleConfig) {
    try {
      await PingRole.create({
        roleId: pingRoleConfig.id,
        server: interaction.member.guild.id
      })
    } catch (error) {
      console.error('Error setting new ping role:', error)
    }
    interaction.reply({ content: `Ping role has been set to ${pingRoleConfig}`, flags: MessageFlags.Ephemeral})
    console.log(`Ping role was set to ${pingRoleConfig} by ${interaction.user}`)
  }
}

// ticket staff

async function cmdStaff(interaction) {
  const permissions = new PermissionsBitField(interaction.member.permissions);
  if (permissions.has(PermissionsBitField.Flags.Administrator)) {
    const staffRoleConfig = interaction.options.getRole('role', true)
    const staffRoleOld = await StaffRole.findOne({ where: { server: interaction.member.guild.id } });
    if (staffRoleOld) {
      try {
        StaffRole.destroy({ where: { server: interaction.member.guild.id } });
      } catch (error) {
        console.error('Error removing staff role from configuration:', error)
      }
    }
    try {
      await StaffRole.create({
        roleId: staffRoleConfig.id,
        server: interaction.member.guild.id
      }) 
    } catch (error) {
      console.error('Error setting new staff role:', error)
    }
    interaction.reply({ content: `Staff role has been set to ${staffRoleConfig}`, flags: MessageFlags.Ephemeral});
    console.log(`Staff role was set to ${staffRoleConfig} by ${interaction.user}`)
  } else {
    interaction.reply({ 
      content: 'You need admin permissions to set the staff role.', 
      flags: MessageFlags.Ephemeral 
    });
  }
}

// ticket open

async function cmdOpen(interaction, targetUser) {
  if (!targetUser) { targetUser = interaction.options.getUser('user', false) }
  if (targetUser && targetUser.id !== interaction.user.id) {
    if (!await hasStaffRole(interaction)) {
      return interaction.reply({ 
        content: 'You need admin permissions or the set staff role to open tickets for other users.', 
        flags: MessageFlags.Ephemeral 
      });
    }
  }

  const user = targetUser || interaction.user;
  const ticketChannelConfig = await TicketChannel.findOne({ where: { server: interaction.member.guild.id } });
  if (!ticketChannelConfig) {
    return interaction.reply({ content: 'Please set a channel for Support Cricket tickets with `/ticket channel`', flags: MessageFlags.Ephemeral })
  }
  const pingRoleConfig = await PingRole.findOne({ where: { server: interaction.member.guild.id } });
  if (!pingRoleConfig) {
    interaction.reply({ content: 'Please set a ping role for Support Cricket tickets with `/ticket ping`', flags: MessageFlags.Ephemeral })
  }
  const channel = client.channels.cache.get(ticketChannelConfig.channelId);
  if (channel) {
    const now = new Date();
    const isoDateOnly = now.toISOString().split('T')[0];
    let ticketType = 'm'; // m = member initated, s = staff initiated
    if (targetUser) {
      ticketType = 's';
    }
    openTicket(interaction, user, channel, isoDateOnly, ticketType);
  } else {
    interaction.reply({ content: 'Please set a channel for Support Cricket with `/ticket channel`', flags: MessageFlags.Ephemeral })
  }
}

// Ticket opening via button

async function btnCmdOpenTicket(interaction) {
  const user = interaction.user;
  const ticketChannelConfig = await TicketChannel.findOne({ where: { server: interaction.member.guild.id } });
  if (!ticketChannelConfig) {
    return interaction.reply({ content: 'Please set a channel for Support Cricket tickets with `/ticket channel`', flags: MessageFlags.Ephemeral })
  }
  const channel = client.channels.cache.get(ticketChannelConfig.channelId);
  if (channel) {
    const now = new Date();
    const isoDateOnly = now.toISOString().split('T')[0];
    let ticketType = 'm'; // button opened tickets can only be this type
    openTicket(interaction, user, channel, isoDateOnly, ticketType);
  } else {
    interaction.reply({ content: 'Please set a channel for Support Cricket with `/ticket channel`', flags: MessageFlags.Ephemeral })
  }  
}

// ticket channel

async function cmdChannel(interaction) {
  if (!await hasStaffRole(interaction)) {
    return interaction.reply({ 
      content: 'You need admin permissions or the staff role to set the ticket channel.', 
      flags: MessageFlags.Ephemeral 
    });
  }
  const pingRoleConfig = await PingRole.findOne({ where: { server: interaction.member.guild.id } });
  if (!pingRoleConfig) {
    return interaction.reply({ content: 'Please set a ping role for Support Cricket tickets with `/ticket ping` to use this command.', flags: MessageFlags.Ephemeral })
  }
  const channel = interaction.options.getChannel('channel', true)
  if (channel.type !== ChannelType.GuildText) {
    return interaction.reply({ content: 'Please select a text channel.', flags: MessageFlags.Ephemeral })
  }
  const ticketChannelConfig = await TicketChannel.findOne({ where: { server: interaction.member.guild.id } });
  if (ticketChannelConfig) {
    try {
      ticketChannelConfig.destroy();
    } catch (error) {
      console.error('Error deleting channel:', error)
    }
  }
  try {
    await TicketChannel.create({
      channelId: channel.id,
      server: interaction.member.guild.id
    }) 
  } catch (error) {
    console.error('Error setting channel:', error)
  }
  interaction.reply({ content: `Ticket channel has been set to ${channel}`, flags: MessageFlags.Ephemeral});
  console.log(`Ticket channel was set to ${ticketChannelConfig} by ${interaction.user}`);
  const btnOpenTicket = new ButtonBuilder()
    .setCustomId('btnOpenTicket')
    .setLabel('Open a ticket')
    .setStyle(ButtonStyle.Primary)
  const row = new ActionRowBuilder().addComponents(btnOpenTicket);
  btnOpenTicketMsg = channel.send({content: 'You can click the button below or use `/ticket open` to open a ticket! A private thread will be created where you can communicate with server staff.', components: [row], withResponse: true})
}

// ticket close

async function cmdClose(interaction) {
  if (interaction.channel.isThread()) {
    interaction.channel.setName('CLOSED-' + interaction.channel.name);
    await interaction.reply({ content: 'Ticket has been closed.', flags: MessageFlags.Ephemeral });
    await interaction.channel.setLocked(true);
    await interaction.channel.setArchived(true);
  } else {
    await interaction.reply({ content: 'This command can only be used in threads.', flags: MessageFlags.Ephemeral });
  }
}

client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
  await registerCommands();
});

client.login(token);