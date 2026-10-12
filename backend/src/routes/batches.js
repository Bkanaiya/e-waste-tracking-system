'use strict';

const express = require('express');
const batches = require('../services/batches');
const items = require('../services/items');
const qr = require('../services/qr');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/http');

const router = express.Router();

const STAFF = ['collector', 'transporter', 'recycler', 'manufacturer'];

async function buildQr(batchId, token) {
    const payload = qr.encode(batchId, token);
    const dataUrl = await qr.toDataUrl(payload);
    return { payload, dataUrl };
}

/** POST /api/batches/finalize — collector seals the day's items into a batch. */
router.post(
    '/finalize',
    requireRole('collector'),
    asyncHandler(async (req, res) => {
        const batch = await batches.finalize(req.user.role);
        const qrInfo = await buildQr(batch.batchId, batch.qrToken);
        res.status(201).json({ ...batch, qr: qrInfo });
    })
);

/** GET /api/batches — list batches. Staff see the batches they currently own
 *  by default; pass ?scope=all to see everything. */
router.get(
    '/',
    requireRole(...STAFF),
    asyncHandler(async (req, res) => {
        const all = req.query.scope === 'all';
        const rows = all
            ? await batches.listAll()
            : await batches.listByOwnerRole(req.user.role);
        res.json(rows);
    })
);

/** GET /api/batches/:id — batch detail (on-chain + off-chain items). */
router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
        const row = await batches.getById(req.params.id);
        if (!row) {
            throw httpError(404, 'Batch not found');
        }
        const batchItems = await items.listByBatch(row.batchId);

        const isCurrentOwner =
            req.user.kind === 'staff' && req.user.role === row.ownerRole;

        const response = {
            batchId: row.batchId,
            date: row.date,
            status: row.status,
            ownerRole: row.ownerRole,
            ownerId: row.ownerId,
            itemCount: row.itemCount,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt || null,
            items: batchItems
        };

        if (isCurrentOwner) {
            response.qr = await buildQr(row.batchId, row.qrToken);
        }

        res.json(response);
    })
);

/** GET /api/batches/:id/qr — the current owner's QR to pass custody on. */
router.get(
    '/:id/qr',
    requireRole(...STAFF),
    asyncHandler(async (req, res) => {
        const row = await batches.getById(req.params.id);
        if (!row) {
            throw httpError(404, 'Batch not found');
        }
        if (row.ownerRole !== req.user.role) {
            throw httpError(403, 'Only the current custodian can view this QR code');
        }
        res.json(await buildQr(row.batchId, row.qrToken));
    })
);

module.exports = router;
