'use strict';

const { randomUUID } = require('crypto');
const { QueryCommand, GetCommand, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const { ddb, TABLES } = require('../db/client');
const { httpError } = require('../utils/http');

async function findByEmail(email) {
    const res = await ddb.send(
        new QueryCommand({
            TableName: TABLES.customers,
            IndexName: 'byEmail',
            KeyConditionExpression: '#e = :email',
            ExpressionAttributeNames: { '#e': 'email' },
            ExpressionAttributeValues: { ':email': email.toLowerCase() },
            Limit: 1
        })
    );
    return res.Items && res.Items[0];
}

async function register({ name, email, phone, address }) {
    if (!name || !email) {
        throw httpError(400, 'name and email are required');
    }
    const existing = await findByEmail(email);
    if (existing) {
        throw httpError(409, 'A customer with this email already exists');
    }

    const customer = {
        customerId: `CUST-${randomUUID().slice(0, 8).toUpperCase()}`,
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        address: address || null,
        createdAt: new Date().toISOString()
    };

    await ddb.send(new PutCommand({ TableName: TABLES.customers, Item: customer }));
    return customer;
}

async function login(email) {
    if (!email) {
        throw httpError(400, 'email is required');
    }
    const customer = await findByEmail(email);
    if (!customer) {
        throw httpError(404, 'No customer found for this email');
    }
    return customer;
}

async function getById(customerId) {
    const res = await ddb.send(
        new GetCommand({ TableName: TABLES.customers, Key: { customerId } })
    );
    return res.Item;
}

async function list() {
    const res = await ddb.send(new ScanCommand({ TableName: TABLES.customers }));
    return res.Items || [];
}

module.exports = { register, login, getById, list, findByEmail };
