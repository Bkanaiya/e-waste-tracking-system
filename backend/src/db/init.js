'use strict';

const {
    CreateTableCommand,
    DescribeTableCommand,
    ResourceNotFoundException
} = require('@aws-sdk/client-dynamodb');

const { baseClient, TABLES } = require('./client');

async function tableExists(name) {
    try {
        await baseClient.send(new DescribeTableCommand({ TableName: name }));
        return true;
    } catch (err) {
        if (err instanceof ResourceNotFoundException || err.name === 'ResourceNotFoundException') {
            return false;
        }
        throw err;
    }
}

async function createTable(params) {
    if (await tableExists(params.TableName)) {
        console.log(`  = ${params.TableName} (already exists)`);
        return;
    }
    await baseClient.send(new CreateTableCommand(params));
    console.log(`  + ${params.TableName} (created)`);
}

async function main() {
    console.log(`Initialising DynamoDB at ${process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000'}`);

    await createTable({
        TableName: TABLES.customers,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
            { AttributeName: 'customerId', AttributeType: 'S' },
            { AttributeName: 'email', AttributeType: 'S' }
        ],
        KeySchema: [{ AttributeName: 'customerId', KeyType: 'HASH' }],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'byEmail',
                KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' }
            }
        ]
    });

    await createTable({
        TableName: TABLES.items,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
            { AttributeName: 'uuid', AttributeType: 'S' },
            { AttributeName: 'date', AttributeType: 'S' },
            { AttributeName: 'batchId', AttributeType: 'S' },
            { AttributeName: 'customerId', AttributeType: 'S' }
        ],
        KeySchema: [{ AttributeName: 'uuid', KeyType: 'HASH' }],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'byDate',
                KeySchema: [{ AttributeName: 'date', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' }
            },
            {
                IndexName: 'byBatch',
                KeySchema: [{ AttributeName: 'batchId', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' }
            },
            {
                IndexName: 'byCustomer',
                KeySchema: [{ AttributeName: 'customerId', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' }
            }
        ]
    });

    await createTable({
        TableName: TABLES.batches,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
            { AttributeName: 'batchId', AttributeType: 'S' },
            { AttributeName: 'date', AttributeType: 'S' },
            { AttributeName: 'ownerRole', AttributeType: 'S' }
        ],
        KeySchema: [{ AttributeName: 'batchId', KeyType: 'HASH' }],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'byDate',
                KeySchema: [{ AttributeName: 'date', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' }
            },
            {
                IndexName: 'byOwnerRole',
                KeySchema: [{ AttributeName: 'ownerRole', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' }
            }
        ]
    });

    console.log('DynamoDB initialisation complete.');
}

main().catch((err) => {
    console.error('Failed to initialise DynamoDB:', err);
    process.exit(1);
});
