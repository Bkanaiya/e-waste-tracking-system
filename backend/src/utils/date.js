'use strict';

function pad(n, width = 2) {
    return String(n).padStart(width, '0');
}

/** Today's date as DD-MM-YYYY (the format used on-chain). */
function today() {
    const d = new Date();
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Build a batch id: BATCH-<DD-MM-YYYY>-<seq>. */
function batchIdFor(date, seq) {
    return `BATCH-${date}-${pad(seq)}`;
}

module.exports = { today, batchIdFor, pad };
