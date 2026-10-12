'use strict';

function httpError(status, message, details) {
    const err = new Error(message);
    err.status = status;
    if (details !== undefined) {
        err.details = details;
    }
    return err;
}

/** Wrap an async Express handler so rejected promises reach the error middleware. */
function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Normalise a Hyperledger Fabric Gateway error into a 4xx friendly message. */
function fabricError(err) {
    if (!err) return err;
    const message = String(err.message || err);
    const match = /message:"([^"]+)"/.exec(message) || /message:([^\n]+)/.exec(message);
    const err2 = httpError(400, match ? match[1] : message);
    return err2;
}

module.exports = { httpError, asyncHandler, fabricError };
