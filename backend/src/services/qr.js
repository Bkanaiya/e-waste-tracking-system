'use strict';

const QRCode = require('qrcode');
const { httpError } = require('../utils/http');

const TYPE = 'EWASTE_BATCH';

/** Build the string that gets encoded into a QR code. */
function encode(batchId, token) {
    return JSON.stringify({ type: TYPE, batchId, token });
}

/** Render a QR payload to a PNG data URL for the browser. */
async function toDataUrl(text) {
    return QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320
    });
}

/** Parse a scanned QR payload, tolerating a "batchId|token" fallback format. */
function parse(text) {
    if (typeof text !== 'string' || text.trim() === '') {
        throw httpError(400, 'Empty QR payload');
    }
    try {
        const obj = JSON.parse(text);
        if (obj && obj.batchId && obj.token) {
            return { batchId: obj.batchId, token: obj.token };
        }
    } catch (err) {
        // fall through to the legacy format
    }
    if (text.includes('|')) {
        const [batchId, token] = text.split('|');
        if (batchId && token) {
            return { batchId: batchId.trim(), token: token.trim() };
        }
    }
    throw httpError(400, 'Invalid QR payload: expected a batch QR code');
}

module.exports = { encode, toDataUrl, parse, TYPE };
