'use strict';

const express = require('express');
const traceService = require('../services/trace');
const { asyncHandler } = require('../utils/http');

const router = express.Router();

/** GET /api/trace/:batchId — public provenance lookup (no auth). */
router.get(
    '/:batchId',
    asyncHandler(async (req, res) => {
        res.json(await traceService.trace(req.params.batchId));
    })
);

module.exports = router;
