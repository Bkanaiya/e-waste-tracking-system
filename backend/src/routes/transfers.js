'use strict';

const express = require('express');
const transfers = require('../services/transfers');
const qr = require('../services/qr');
const { requireRole } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/http');

const router = express.Router();

const STAFF = ['collector', 'transporter', 'recycler', 'manufacturer'];

/** POST /api/transfers/scan — scan a batch QR to take custody. */
router.post(
    '/scan',
    requireRole(...STAFF),
    asyncHandler(async (req, res) => {
        const { qr: qrPayload } = req.body || {};
        if (!qrPayload) {
            throw httpError(400, 'qr payload is required');
        }
        const onChain = await transfers.scan(req.user.role, qrPayload);
        const payload = qr.encode(onChain.batchId, onChain.qrToken);
        const dataUrl = await qr.toDataUrl(payload);
        res.json({
            batchId: onChain.batchId,
            status: onChain.status,
            ownerRole: onChain.ownerRole,
            ownerId: onChain.ownerId,
            updatedAt: onChain.updatedAt,
            qr: { payload, dataUrl }
        });
    })
);

module.exports = router;
