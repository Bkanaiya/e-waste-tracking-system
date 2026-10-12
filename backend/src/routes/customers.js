'use strict';

const express = require('express');
const customers = require('../services/customers');
const { requireAuth, requireCustomer, requireRole } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/http');

const router = express.Router();

/** GET /api/customers/me — current customer profile. */
router.get(
    '/me',
    requireCustomer,
    asyncHandler(async (req, res) => {
        const customer = await customers.getById(req.user.customerId);
        if (!customer) {
            throw httpError(404, 'Customer not found');
        }
        res.json(customer);
    })
);

/** GET /api/customers — staff-only customer directory. */
router.get(
    '/',
    requireRole('collector', 'transporter', 'recycler', 'manufacturer'),
    asyncHandler(async (req, res) => {
        res.json(await customers.list());
    })
);

module.exports = router;
