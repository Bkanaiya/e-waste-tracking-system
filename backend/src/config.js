'use strict';

const path = require('path');
require('dotenv').config();

function required(name, fallback) {
    const value = process.env[name] || fallback;
    if (value === undefined || value === '') {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

const cryptoRoot = required(
    'FABRIC_CRYPTO_ROOT',
    path.resolve(__dirname, '../../../fabric-samples/test-network/organizations')
);

const config = {
    port: parseInt(process.env.PORT || '4000', 10),

    auth: {
        jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h'
    },

    fabric: {
        cryptoRoot,
        channelName: required('CHANNEL_NAME', 'mychannel'),
        chaincodeName: required('CHAINCODE_NAME', 'ewaste')
    },

    dynamo: {
        endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local'
        }
    },

    staff: {
        collector: { org: 'org1', password: process.env.STAFF_COLLECTOR_PASSWORD || 'collectorpw' },
        transporter: { org: 'org1', password: process.env.STAFF_TRANSPORTER_PASSWORD || 'transporterpw' },
        recycler: { org: 'org2', password: process.env.STAFF_RECYCLER_PASSWORD || 'recyclerpw' },
        manufacturer: { org: 'org2', password: process.env.STAFF_MANUFACTURER_PASSWORD || 'manufacturerpw' }
    }
};

module.exports = config;
