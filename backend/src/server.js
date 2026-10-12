'use strict';

const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
    console.log(`E-Waste backend listening on http://localhost:${config.port}`);
    console.log(`  channel=${config.fabric.channelName} chaincode=${config.fabric.chaincodeName}`);
});

function shutdown(signal) {
    console.log(`\n${signal} received, shutting down...`);
    server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
