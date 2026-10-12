'use strict';

const {
    QueryCommand,
    GetCommand,
    PutCommand
} = require('@aws-sdk/lib-dynamodb');

const { ddb, TABLES } = require('../db/client');
const { httpError, fabricError } = require('../utils/http');
const { today, batchIdFor } = require('../utils/date');
const itemsService = require('./items');
const fabric = require('../fabric/gateway');

async function queryByIndex(indexName, keyName, value) {
    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLES.batches,
            IndexName: indexName,
            KeyConditionExpression: '#k = :v',
            ExpressionAttributeNames: { '#k': keyName },
            ExpressionAttributeValues: { ':v': value }
        })
    );
    return res.Items || [];
}

function listByDateStatus(date) {
    return queryByIndex('byDate', 'date', date);
}

function listByOwnerRole(role) {
    return queryByIndex('byOwnerRole', 'ownerRole', role);
}

async function listAll() {
    const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
    const res = await ddb.send(new ScanCommand({ TableName: TABLES.batches }));
    return (res.Items || []).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function getById(batchId) {
    const res = await ddb.send(
        new GetCommand({ TableName: TABLES.batches, Key: { batchId } })
    );
    return res.Item;
}

async function putRow(row) {
    await ddb.send(new PutCommand({ TableName: TABLES.batches, Item: row }));
    return row;
}

/** Collect a day's pending items and register them as a new on-chain batch. */
async function finalize(collectorId) {
    const date = today();
    const pending = await itemsService.pendingForDate(date);
    if (pending.length === 0) {
        throw httpError(400, `No pending e-waste items to batch for ${date}`);
    }

    const sameDay = await listByDateStatus(date);
    const seq = sameDay.length + 1;
    const batchId = batchIdFor(date, seq);
    const uuids = pending.map((item) => item.uuid);

    let onChain;
    try {
        onChain = await fabric.submitTransaction(
            'collector',
            'CreateBatch',
            batchId,
            date,
            JSON.stringify(uuids),
            collectorId
        );
    } catch (err) {
        throw fabricError(err);
    }

    await itemsService.assignToBatch(date, batchId);

    const row = {
        batchId,
        date,
        itemCount: uuids.length,
        itemUuids: uuids,
        ownerRole: onChain.ownerRole,
        ownerId: onChain.ownerId,
        status: onChain.status,
        qrToken: onChain.qrToken,
        createdAt: onChain.createdAt
    };
    await putRow(row);
    return row;
}

async function updateOwnership(batchId, onChain) {
    const row = await getById(batchId);
    if (!row) {
        return putRow({
            batchId,
            date: onChain.date,
            itemCount: onChain.itemCount,
            itemUuids: onChain.itemUuids,
            ownerRole: onChain.ownerRole,
            ownerId: onChain.ownerId,
            status: onChain.status,
            qrToken: onChain.qrToken,
            createdAt: onChain.createdAt
        });
    }
    row.ownerRole = onChain.ownerRole;
    row.ownerId = onChain.ownerId;
    row.status = onChain.status;
    row.qrToken = onChain.qrToken;
    row.updatedAt = onChain.updatedAt;
    return putRow(row);
}

module.exports = {
    finalize,
    listByDateStatus,
    listByOwnerRole,
    listAll,
    getById,
    putRow,
    updateOwnership
};
