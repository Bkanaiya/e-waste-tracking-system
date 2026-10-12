'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const config = require('../config');

const baseClient = new DynamoDBClient({
    endpoint: config.dynamo.endpoint,
    region: config.dynamo.region,
    credentials: config.dynamo.credentials
});

const ddb = DynamoDBDocumentClient.from(baseClient, {
    marshallOptions: { removeUndefinedValues: true }
});

const TABLES = {
    customers: 'Customers',
    items: 'EwasteItems',
    batches: 'Batches'
};

module.exports = { ddb, baseClient, TABLES };
