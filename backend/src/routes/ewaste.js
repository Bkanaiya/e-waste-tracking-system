'use strict';

const express = require('express');
const items = require('../services/items');
const { requireAuth, requireCustomer } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/http');

const router = express.Router();

/** GET /api/ewaste/categories — supported e-waste categories. */
router.get('/categories', (req, res) => {
    res.json({ categories: items.VALID_CATEGORIES });
});

/** POST /api/ewaste — a customer submits an e-waste item. */
router.post(
    '/',
    requireCustomer,
    asyncHandler(async (req, res) => {
        const item = await items.submit(req.user, req.body || {});
        res.status(201).json(item);
    })
);

/** GET /api/ewaste/mine — the current customer's submitted items. */
router.get(
    '/mine',
    requireCustomer,
    asyncHandler(async (req, res) => {
        res.json(await items.listByCustomer(req.user.customerId));
    })
);

/** GET /api/ewaste/:uuid — item lookup (owner or staff). */
router.get(
    '/:uuid',
    requireAuth,
    asyncHandler(async (req, res) => {
        const item = await items.getById(req.params.uuid);
        if (!item) {
            throw httpError(404, 'Item not found');
        }
        if (req.user.kind === 'customer' && item.customerId !== req.user.customerId) {
            throw httpError(403, 'Not your item');
        }
        res.json(item);
    })
);

module.exports = router;
