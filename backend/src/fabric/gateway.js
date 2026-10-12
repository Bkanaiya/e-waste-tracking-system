'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');

const config = require('../config');
const { getIdentity } = require('./identities');

function firstFileIn(dir) {
    const entries = fs.readdirSync(dir);
    if (entries.length === 0) {
        throw new Error(`No files found in directory: ${dir}`);
    }
    return path.join(dir, entries[0]);
}

async function newGrpcConnection(identity) {
    const tlsRootCert = await fs.promises.readFile(identity.tlsCertPath);
    const credentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(identity.peerEndpoint, credentials, {
        'grpc.ssl_target_name_override': identity.peerHostAlias,
        'grpc.default_authority': identity.peerHostAlias
    });
}

async function newIdentity(identity) {
    const certPath = firstFileIn(identity.certDir);
    const credentials = await fs.promises.readFile(certPath);
    return { mspId: identity.mspId, credentials };
}

async function newSigner(identity) {
    const keyPath = firstFileIn(identity.keyDir);
    const privateKeyPem = await fs.promises.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

/**
 * Run `fn(contract)` with a Fabric Gateway connection bound to the given role.
 * The connection is established and torn down for each call which keeps the
 * module stateless and resilient to network restarts.
 */
async function withContract(role, fn) {
    const identity = getIdentity(role);
    const client = await newGrpcConnection(identity);
    const gateway = connect({
        client,
        identity: await newIdentity(identity),
        signer: await newSigner(identity),
        hash: hash.sha256
    });

    try {
        const network = gateway.getNetwork(config.fabric.channelName);
        const contract = network.getContract(config.fabric.chaincodeName);
        return await fn(contract);
    } finally {
        gateway.close();
        client.close();
    }
}

function decode(bytes) {
    return bytes && bytes.length > 0 ? Buffer.from(bytes).toString('utf8') : null;
}

async function submitTransaction(role, fnName, ...args) {
    const result = await withContract(role, (contract) =>
        contract.submitTransaction(fnName, ...args)
    );
    const text = decode(result);
    return text ? JSON.parse(text) : null;
}

async function evaluateTransaction(role, fnName, ...args) {
    const result = await withContract(role, (contract) =>
        contract.evaluateTransaction(fnName, ...args)
    );
    const text = decode(result);
    return text ? JSON.parse(text) : null;
}

module.exports = { submitTransaction, evaluateTransaction };
