'use strict';

const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub } = require('fabric-shim');

const EwasteContract = require('../lib/ewasteContract.js');

const assert = sinon.assert;
chai.use(sinonChai);

const BATCH_ID = 'BATCH-11-10-2026-01';
const DATE = '11-10-2026';
const UUIDS = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];

describe('E-Waste Tracking Chaincode', () => {
    let ctx, stub, contract;

    beforeEach(() => {
        ctx = new Context();

        stub = sinon.createStubInstance(ChaincodeStub);
        ctx.setChaincodeStub(stub);

        stub.states = {};

        stub.putState.callsFake(async (key, value) => {
            stub.states[key] = value;
        });
        stub.getState.callsFake(async (key) => Promise.resolve(stub.states[key]));
        stub.deleteState.callsFake(async (key) => {
            delete stub.states[key];
            return Promise.resolve(key);
        });
        function makeIterator(items) {
            let i = 0;
            return {
                next: async () => Promise.resolve(i < items.length
                    ? { done: false, value: items[i++] }
                    : { done: true, value: undefined }),
                close: async () => Promise.resolve(),
            };
        }
        stub.getStateByRange.callsFake(async (startKey, endKey) => {
            const items = Object.keys(stub.states)
                .filter((key) => key >= startKey && key < endKey)
                .map((key) => ({ key, value: stub.states[key] }));
            return makeIterator(items);
        });
        stub.getHistoryForKey.callsFake(async () => makeIterator(stub.history || []));
        stub.getTxID.returns('tx-1');
        stub.getTxTimestamp.returns({ seconds: { low: 1700000000 }, nanos: 0 });

        contract = new EwasteContract();
    });

    function asRole(role) {
        sinon.stub(contract, '_callerRole').returns(role);
    }

    describe('CreateBatch', () => {
        it('creates a batch owned by the collector', async () => {
            asRole('collector');
            sinon.stub(contract, '_callerId').returns('collector-1');

            const raw = await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'collector-1');
            const batch = JSON.parse(raw);

            expect(batch.batchId).to.equal(BATCH_ID);
            expect(batch.date).to.equal(DATE);
            expect(batch.itemUuids).to.eql(UUIDS);
            expect(batch.itemCount).to.equal(2);
            expect(batch.ownerRole).to.equal('collector');
            expect(batch.status).to.equal('AT_COLLECTOR');
            expect(batch.qrToken).to.be.a('string').with.length(64);
            expect(stub.states[BATCH_ID]).to.not.equal(undefined);
            expect(stub.states['idx~owner~collector~' + BATCH_ID].toString()).to.equal(BATCH_ID);
        });

        it('rejects non-collector callers', async () => {
            asRole('transporter');
            try {
                await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'x');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.contain('Access denied');
            }
        });

        it('rejects duplicate batches', async () => {
            asRole('collector');
            sinon.stub(contract, '_callerId').returns('collector-1');
            await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'collector-1');
            try {
                await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'collector-1');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.equal(`Batch ${BATCH_ID} already exists`);
            }
        });

        it('rejects malformed uuid list', async () => {
            asRole('collector');
            try {
                await contract.CreateBatch(ctx, BATCH_ID, DATE, 'not-json', 'c');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.equal('itemUuids must be a valid JSON array');
            }
        });

        it('rejects empty uuid list', async () => {
            asRole('collector');
            try {
                await contract.CreateBatch(ctx, BATCH_ID, DATE, '[]', 'c');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.equal('itemUuids must be a non-empty JSON array');
            }
        });
    });

    describe('ReadBatch / BatchExists', () => {
        it('round-trips a batch', async () => {
            asRole('collector');
            sinon.stub(contract, '_callerId').returns('c');
            await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'c');
            const batch = JSON.parse(await contract.ReadBatch(ctx, BATCH_ID));
            expect(batch.batchId).to.equal(BATCH_ID);
            expect(await contract.BatchExists(ctx, BATCH_ID)).to.equal(true);
            expect(await contract.BatchExists(ctx, 'missing')).to.equal(false);
        });

        it('throws for missing batch', async () => {
            try {
                await contract.ReadBatch(ctx, 'missing');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.equal('Batch missing does not exist');
            }
        });
    });

    describe('TransferBatch', () => {
        async function create() {
            asRole('collector');
            sinon.stub(contract, '_callerId').returns('collector-1');
            const raw = await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'collector-1');
            return JSON.parse(raw);
        }

        it('moves collector -> transporter with the correct token', async () => {
            const batch = await create();
            contract._callerRole.restore();
            asRole('transporter');
            contract._callerId.restore();
            sinon.stub(contract, '_callerId').returns('transporter-1');

            const updated = JSON.parse(await contract.TransferBatch(ctx, BATCH_ID, batch.qrToken));
            expect(updated.ownerRole).to.equal('transporter');
            expect(updated.status).to.equal('IN_TRANSIT');
            expect(updated.qrToken).to.not.equal(batch.qrToken);
            expect(stub.states['idx~owner~collector~' + BATCH_ID]).to.equal(undefined);
            expect(stub.states['idx~owner~transporter~' + BATCH_ID].toString()).to.equal(BATCH_ID);
        });

        it('completes the full chain to manufacturer', async () => {
            const batch = await create();
            contract._callerRole.restore();
            contract._callerId.restore();

            let token = batch.qrToken;
            const chain = [
                ['transporter', 'IN_TRANSIT'],
                ['recycler', 'AT_RECYCLER'],
                ['manufacturer', 'SOLD_TO_MANUFACTURER'],
            ];
            for (const [role, status] of chain) {
                sinon.stub(contract, '_callerRole').returns(role);
                sinon.stub(contract, '_callerId').returns(role + '-1');
                const res = JSON.parse(await contract.TransferBatch(ctx, BATCH_ID, token));
                expect(res.ownerRole).to.equal(role);
                expect(res.status).to.equal(status);
                token = res.qrToken;
                contract._callerRole.restore();
                contract._callerId.restore();
            }
        });

        it('rejects an invalid token', async () => {
            await create();
            contract._callerRole.restore();
            asRole('transporter');
            try {
                await contract.TransferBatch(ctx, BATCH_ID, 'wrong-token');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.equal('Invalid or expired QR token');
            }
        });

        it('rejects an out-of-order role', async () => {
            await create();
            contract._callerRole.restore();
            asRole('recycler');
            try {
                await contract.TransferBatch(ctx, BATCH_ID, 'whatever');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.contain('Access denied');
            }
        });

        it('rejects transfer once owned by the manufacturer', async () => {
            stub.states[BATCH_ID] = Buffer.from(JSON.stringify({
                batchId: BATCH_ID, ownerRole: 'manufacturer', qrToken: 't', history: [],
            }));
            asRole('manufacturer');
            try {
                await contract.TransferBatch(ctx, BATCH_ID, 't');
                assert.fail('should have thrown');
            } catch (err) {
                expect(err.message).to.contain('cannot be transferred further');
            }
        });
    });

    describe('GetBatchHistory / QueryBatchesByOwner', () => {
        it('returns provenance history', async () => {
            asRole('collector');
            sinon.stub(contract, '_callerId').returns('c');
            await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'c');
            stub.history = [
                { txId: 'tx-1', timestamp: null, isDelete: false, value: stub.states[BATCH_ID] },
            ];
            const history = JSON.parse(await contract.GetBatchHistory(ctx, BATCH_ID));
            expect(history).to.have.length(1);
            expect(history[0].txId).to.equal('tx-1');
        });

        it('queries batches by owner role', async () => {
            asRole('collector');
            sinon.stub(contract, '_callerId').returns('c');
            await contract.CreateBatch(ctx, BATCH_ID, DATE, JSON.stringify(UUIDS), 'c');
            const owned = JSON.parse(await contract.QueryBatchesByOwner(ctx, 'collector'));
            expect(owned).to.have.length(1);
            expect(owned[0].batchId).to.equal(BATCH_ID);
            const none = JSON.parse(await contract.QueryBatchesByOwner(ctx, 'manufacturer'));
            expect(none).to.have.length(0);
        });
    });
});
