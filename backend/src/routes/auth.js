'use strict';

const express = require('express');
const config = require('../config');
const customers = require('../services/customers');
const { sign } = require('../middleware/auth');
const { asyncHandler, httpError } = require('../utils/http');

const router = express.Router();

const ROLES = Object.keys(config.staff);

/** POST /api/auth/register — register a customer and return a token. */
router.post(
    '/register',
    asyncHandler(async (req, res) => {
        const customer = await customers.register(req.body || {});
        const token = sign({
            kind: 'customer',
            sub: customer.customerId,
            customerId: customer.customerId,
            name: customer.name,
            email: customer.email
        });
        res.status(201).json({ token, customer });
    })
);

/** POST /api/auth/login — customer sign-in by email (passwordless demo login). */
router.post(
    '/login',
    asyncHandler(async (req, res) => {
        const { email } = req.body || {};
        const customer = await customers.login(email);
        const token = sign({
            kind: 'customer',
            sub: customer.customerId,
            customerId: customer.customerId,
            name: customer.name,
            email: customer.email
        });
        res.json({ token, customer });
    })
);

/** POST /api/auth/staff/login — role-based sign-in for the four staff portals. */
router.post(
    '/staff/login',
    asyncHandler(async (req, res) => {
        const { role, password } = req.body || {};
        if (!ROLES.includes(role)) {
            throw httpError(400, `role must be one of: ${ROLES.join(', ')}`);
        }
        const expected = config.staff[role].password;
        if (password !== expected) {
            throw httpError(401, 'Invalid credentials');
        }
        const token = sign({ kind: 'staff', sub: role, role });
        res.json({ token, staff: { role } });
    })
);

/** GET /api/auth/roles — list available staff roles (for the login screen). */
router.get('/roles', (req, res) => {
    res.json({ roles: ROLES });
});

module.exports = router;
