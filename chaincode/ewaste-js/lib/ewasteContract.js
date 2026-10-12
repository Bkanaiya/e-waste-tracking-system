'use strict';

const crypto = require('crypto');
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

const ROLES = {
    COLLECTOR: 'collector',
    TRANSPORTER: 'transporter',
    RECYCLER: 'recycler',
    MANUFACTURER: 'manufacturer',
};

// Valid custody chain. Each current owner role may only hand the batch to the
// role defined here, which also determines the resulting status.
const TRANSITIONS = {
    [ROLES.COLLECTOR]: { next: ROLES.TRANSPORTER, status: 'IN_TRANSIT' },
    [ROLES.TRANSPORTER]: { next: ROLES.RECYCLER, status: 'AT_RECYCLER' },
    [ROLES.RECYCLER]: { next: ROLES.MANUFACTURER, status: 'SOLD_TO_MANUFACTURER' },
};

const STATUS_AT_COLLECTOR = 'AT_COLLECTOR';
const DOC_TYPE = 'batch';
const INDEX_PREFIX = 'idx~owner~';

function sha256(...parts) {
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

class EwasteContract extends Contract {

    // ---- helpers -------------------------------------------------------

    _callerRole(ctx) {
        const role = ctx.clientIdentity.getAttributeValue('role');
        return role || null;
    }

    _callerId(ctx) {
        return ctx.clientIdentity.getAttributeValue('uid') || ctx.clientIdentity.getID();
    }

    _requireRole(ctx, expected) {
        const role = this._callerRole(ctx);
        if (!role) {
            throw new Error('Access denied: caller identity has no "role" attribute');
        }
        if (role !== expected) {
            throw new Error(`Access denied: role "${role}" cannot perform this action (expected "${expected}")`);
        }
        return role;
    }

    _txTime(ctx) {
        const ts = ctx.stub.getTxTimestamp();
        let seconds = ts.seconds;
        if (seconds && typeof seconds === 'object') {
            seconds = seconds.low !== undefined ? seconds.low : 0;
        }
        const millis = Number(seconds) * 1000 + Math.floor(Number(ts.nanos || 0) / 1e6);
        return new Date(millis).toISOString();
    }

    _indexKey(role, batchId) {
        return `${INDEX_PREFIX}${role}~${batchId}`;
    }

    // ---- transactions --------------------------------------------------

    /**
     * CreateBatch registers a day's e-waste batch on the ledger.
     * Only a caller with role=collector may create a batch.
     * @param {string} batchId  e.g. BATCH-11-10-2026-01
     * @param {string} date     DD-MM-YYYY
     * @param {string} itemUuidsJson JSON array of e-waste UUIDs in this batch
     */
    async CreateBatch(ctx, batchId, date, itemUuidsJson, collectorId) {
        this._requireRole(ctx, ROLES.COLLECTOR);

        if (!batchId) {
            throw new Error('batchId is required');
        }
        if (!date) {
            throw new Error('date is required');
        }
        if (await this.BatchExists(ctx, batchId)) {
            throw new Error(`Batch ${batchId} already exists`);
        }

        let itemUuids;
        try {
            itemUuids = JSON.parse(itemUuidsJson);
        } catch (err) {
            throw new Error('itemUuids must be a valid JSON array');
        }
        if (!Array.isArray(itemUuids) || itemUuids.length === 0) {
            throw new Error('itemUuids must be a non-empty JSON array');
        }

        const txId = ctx.stub.getTxID();
        const at = this._txTime(ctx);
        const ownerId = collectorId || this._callerId(ctx);

        const batch = {
            docType: DOC_TYPE,
            batchId,
            date,
            itemUuids,
            itemCount: itemUuids.length,
            ownerRole: ROLES.COLLECTOR,
            ownerId,
            status: STATUS_AT_COLLECTOR,
            qrToken: sha256(batchId, date, ROLES.COLLECTOR, txId),
            createdAt: at,
            updatedAt: at,
            history: [
                { role: ROLES.COLLECTOR, id: ownerId, action: 'CREATED', status: STATUS_AT_COLLECTOR, at },
            ],
        };

        await ctx.stub.putState(batchId, Buffer.from(stringify(sortKeysRecursive(batch))));
        await ctx.stub.putState(this._indexKey(ROLES.COLLECTOR, batchId), Buffer.from(batchId));
        return JSON.stringify(batch);
    }

    /**
     * TransferBatch transfers custody of a batch to the caller.
     * The caller's role must be the valid next hop for the current owner and
     * must present the current one-time qrToken. A fresh token is issued.
     */
    async TransferBatch(ctx, batchId, qrToken) {
        const batch = JSON.parse(await this.ReadBatch(ctx, batchId));

        const transition = TRANSITIONS[batch.ownerRole];
        if (!transition) {
            throw new Error(`Batch ${batchId} cannot be transferred further (current owner: ${batch.ownerRole})`);
        }

        const callerRole = this._requireRole(ctx, transition.next);

        if (!qrToken || qrToken !== batch.qrToken) {
            throw new Error('Invalid or expired QR token');
        }

        const txId = ctx.stub.getTxID();
        const at = this._txTime(ctx);
        const callerId = this._callerId(ctx);
        const previousOwnerRole = batch.ownerRole;

        batch.ownerRole = callerRole;
        batch.ownerId = callerId;
        batch.status = transition.status;
        batch.qrToken = sha256(batchId, batch.qrToken, callerRole, txId);
        batch.updatedAt = at;
        batch.history.push({
            role: callerRole,
            id: callerId,
            action: 'TRANSFERRED_IN',
            from: previousOwnerRole,
            status: transition.status,
            at,
        });

        await ctx.stub.putState(batchId, Buffer.from(stringify(sortKeysRecursive(batch))));
        await ctx.stub.deleteState(this._indexKey(previousOwnerRole, batchId));
        await ctx.stub.putState(this._indexKey(callerRole, batchId), Buffer.from(batchId));

        return JSON.stringify(batch);
    }

    // ---- queries -------------------------------------------------------

    async ReadBatch(ctx, batchId) {
        const batchBytes = await ctx.stub.getState(batchId);
        if (!batchBytes || batchBytes.length === 0) {
            throw new Error(`Batch ${batchId} does not exist`);
        }
        return batchBytes.toString();
    }

    async BatchExists(ctx, batchId) {
        const batchBytes = await ctx.stub.getState(batchId);
        return !!(batchBytes && batchBytes.length > 0);
    }

    async GetBatchHistory(ctx, batchId) {
        const results = [];
        const iterator = await ctx.stub.getHistoryForKey(batchId);
        let res = await iterator.next();
        while (!res.done) {
            const record = {
                txId: res.value.txId,
                timestamp: res.value.timestamp,
                isDelete: res.value.isDelete,
            };
            try {
                record.value = JSON.parse(res.value.value.toString('utf8'));
            } catch (err) {
                record.value = res.value.value.toString('utf8');
            }
            results.push(record);
            res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    async QueryBatchesByOwner(ctx, role) {
        const results = [];
        const startKey = this._indexKey(role, '');
        const endKey = this._indexKey(role, '\uffff');
        const iterator = await ctx.stub.getStateByRange(startKey, endKey);
        let res = await iterator.next();
        while (!res.done) {
            const batchId = res.value.value.toString('utf8');
            const batchBytes = await ctx.stub.getState(batchId);
            if (batchBytes && batchBytes.length > 0) {
                results.push(JSON.parse(batchBytes.toString()));
            }
            res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }
}

module.exports = EwasteContract;
module.exports.ROLES = ROLES;
