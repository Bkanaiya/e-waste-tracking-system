'use strict';

const path = require('path');
const config = require('../config');

const { cryptoRoot } = config.fabric;

function orgPaths(org, user) {
    const orgDir = path.join(cryptoRoot, 'peerOrganizations', `${org}.example.com`);
    const userDir = path.join(orgDir, 'users', `${user}@${org}.example.com`, 'msp');
    return {
        mspId: org === 'org1' ? 'Org1MSP' : 'Org2MSP',
        certDir: path.join(userDir, 'signcerts'),
        keyDir: path.join(userDir, 'keystore'),
        tlsCertPath: path.join(orgDir, 'peers', `peer0.${org}.example.com`, 'tls', 'ca.crt'),
        peerEndpoint: org === 'org1' ? 'localhost:7051' : 'localhost:9051',
        peerHostAlias: `peer0.${org}.example.com`
    };
}

// Map each application role to a Fabric identity (registered with an ECert role attribute).
const identities = {
    collector: { ...orgPaths('org1', 'collector'), role: 'collector' },
    transporter: { ...orgPaths('org1', 'transporter'), role: 'transporter' },
    recycler: { ...orgPaths('org2', 'recycler'), role: 'recycler' },
    manufacturer: { ...orgPaths('org2', 'manufacturer'), role: 'manufacturer' }
};

function getIdentity(role) {
    const identity = identities[role];
    if (!identity) {
        throw new Error(`Unknown Fabric role: ${role}`);
    }
    return identity;
}

module.exports = { identities, getIdentity };
