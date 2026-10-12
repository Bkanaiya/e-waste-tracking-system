'use strict';

const { fabricError } = require('../utils/http');
const fabric = require('../fabric/gateway');
const qr = require('./qr');
const batches = require('./batches');

/**
 * Handle a QR scan: transfer custody of a batch to the caller's role.
 * The caller must be the valid next custodian and present the current token.
 */
async function scan(role, qrPayload) {
    const { batchId, token } = qr.parse(qrPayload);

    let onChain;
    try {
        onChain = await fabric.submitTransaction(role, 'TransferBatch', batchId, token);
    } catch (err) {
        throw fabricError(err);
    }

    await batches.updateOwnership(batchId, onChain);
    return onChain;
}

module.exports = { scan };
