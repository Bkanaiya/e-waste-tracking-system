'use strict';

const { randomUUID } = require('crypto');
const { QueryCommand, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const { ddb, TABLES } = require('../db/client');
const { httpError } = require('../utils/http');
const { today } = require('../utils/date');

const VALID_CATEGORIES = ['Mobile', 'Laptop', 'Battery', 'Charger', 'Monitor', 'Printer', 'Other'];

function itemUuid() {
    return `EW-${randomUUID().slice(0, 4).toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

async function submit(customer, payload) {
    const { category, brand, model, condition, collectionPoint, weightKg } = payload || {};
    if (!category) {
        throw httpError(400, 'category is required');
    }
    if (!VALID_CATEGORIES.includes(category)) {
        throw httpError(400, `category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    const item = {
        uuid: itemUuid(),
        customerId: customer.customerId,
        customerName: customer.name,
        category,
        brand: brand || null,
        model: model || null,
        condition: condition || 'Working',
        collectionPoint: collectionPoint || null,
        weightKg: weightKg !== undefined && weightKg !== null ? Number(weightKg) : null,
        date: today(),
        // NB: batchId is the hash key of a GSI, so it must be omitted (not null)
        // until the item is assigned to a batch.
        status: 'SUBMITTED',
        createdAt: new Date().toISOString()
    };

    await ddb.send(new PutCommand({ TableName: TABLES.items, Item: item }));
    return item;
}

async function getById(uuid) {
    const res = await ddb.send(
        new GetCommand({ TableName: TABLES.items, Key: { uuid } })
    );
    return res.Item;
}

async function queryByIndex(indexName, keyName, value) {
    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLES.items,
            IndexName: indexName,
            KeyConditionExpression: '#k = :v',
            ExpressionAttributeNames: { '#k': keyName },
            ExpressionAttributeValues: { ':v': value }
        })
    );
    return res.Items || [];
}

async function listByCustomer(customerId) {
    const items = await queryByIndex('byCustomer', 'customerId', customerId);
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

async function listByDate(date) {
    return queryByIndex('byDate', 'date', date);
}

async function listByBatch(batchId) {
    return queryByIndex('byBatch', 'batchId', batchId);
}

/** Return the un-batched ("pending") items for a given date. */
async function pendingForDate(date) {
    const items = await listByDate(date);
    return items.filter((item) => !item.batchId);
}

async function assignToBatch(date, batchId) {
    const pending = await pendingForDate(date);
    for (const item of pending) {
        const updated = { ...item, batchId, status: 'BATCHED' };
        await ddb.send(new PutCommand({ TableName: TABLES.items, Item: updated }));
    }
    return pending;
}

module.exports = {
    submit,
    getById,
    listByCustomer,
    listByDate,
    listByBatch,
    pendingForDate,
    assignToBatch,
    VALID_CATEGORIES
};
