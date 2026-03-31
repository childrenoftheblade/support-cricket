const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'database.sqlite',
});

const TicketChannel = sequelize.define('ticketChannel', {
    server: Sequelize.TEXT,
    channelId: Sequelize.TEXT,
});

const PingRole = sequelize.define('pingRole', {
    server: Sequelize.TEXT,
    roleId: Sequelize.TEXT,
});

const StaffRole = sequelize.define('staffRole', {
    server: Sequelize.TEXT,
    roleId: Sequelize.TEXT,
});

TicketChannel.sync();
PingRole.sync();
StaffRole.sync();

module.exports = { TicketChannel, PingRole, StaffRole }
