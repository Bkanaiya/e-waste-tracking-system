'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const { httpError } = require('../utils/http');

function sign(payload) {
    return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
}

function extractToken(req) {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
        return header.slice(7);
    }
    return null;
}

/** Require any valid token (staff or customer). */
function requireAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return next(httpError(401, 'Authentication required'));
    }
    try {
        req.user = jwt.verify(token, config.auth.jwtSecret);
        next();
    } catch (err) {
        next(httpError(401, 'Invalid or expired token'));
    }
}

/** Require a staff token whose role is in the allowed list. */
function requireRole(...roles) {
    return (req, res, next) => {
        requireAuth(req, res, (err) => {
            if (err) return next(err);
            if (req.user.kind !== 'staff') {
                return next(httpError(403, 'Staff access required'));
            }
            if (roles.length && !roles.includes(req.user.role)) {
                return next(httpError(403, `This action requires role: ${roles.join(' or ')}`));
            }
            next();
        });
    };
}

/** Require a customer token. */
function requireCustomer(req, res, next) {
    requireAuth(req, res, (err) => {
        if (err) return next(err);
        if (req.user.kind !== 'customer') {
            return next(httpError(403, 'Customer access required'));
        }
        next();
    });
}

module.exports = { sign, requireAuth, requireRole, requireCustomer };
