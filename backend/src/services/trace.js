'use strict';

const { fabricError } = require('../utils/http');
const fabric = require('../fabric/gateway');
const items = require('./items');
const batches = require('./batches');

/**
 * Public provenance lookup. Returns the on-chain batch record, its custody
 * history and the off-chain item details. The current QR token is never
 * exposed here — it is only handed to the current custodian.
 */
async function trace(batchId) {
    let onChain;
    try {
        onChain = await fabric.evaluateTransaction('collector', 'ReadBatch', batchId);
    } catch (err) {
        const e = fabricError(err);
        if (/does not exist/i.test(e.message)) {
            e.status = 404;
        }
        throw e;
    }

    const offChainItems = await items.listByBatch(batchId);
    const row = await batches.getById(batchId);

    return {
        batch: {
            batchId: onChain.batchId,
            date: onChain.date,
            status: onChain.status,
            ownerRole: onChain.ownerRole,
            itemCount: onChain.itemCount,
            createdAt: onChain.createdAt,
            updatedAt: onChain.updatedAt
        },
        items: offChainItems.map((item) => ({
            uuid: item.uuid,
            category: item.category,
            brand: item.brand,
            model: item.model,
            condition: item.condition,
            weightKg: item.weightKg,
            collectionPoint: item.collectionPoint
        })),
        provenance: onChain.history || [],
        offChain: row ? { status: row.status, ownerRole: row.ownerRole } : null
    };
}

module.exports = { trace };
