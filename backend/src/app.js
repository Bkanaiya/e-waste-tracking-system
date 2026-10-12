'use strict';

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const ewasteRoutes = require('./routes/ewaste');
const batchRoutes = require('./routes/batches');
const transferRoutes = require('./routes/transfers');
const traceRoutes = require('./routes/trace');

const { httpError } = require('./utils/http');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'ewaste-backend', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/ewaste', ewasteRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/trace', traceRoutes);

// 404
app.use((req, res, next) => {
    next(httpError(404, `Not found: ${req.method} ${req.originalUrl}`));
});

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) {
        console.error(err);
    }
    res.status(status).json({
        error: err.message || 'Internal server error',
        ...(err.details ? { details: err.details } : {})
    });
});

module.exports = app;
