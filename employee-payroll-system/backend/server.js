const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const departmentsRouter = require('./routes/departments');
const employeesRouter = require('./routes/employees');
const salaryAdvancesRouter = require('./routes/salaryAdvances');
const payrollRouter = require('./routes/payroll');
const auditLogRouter = require('./routes/auditLog');

const app = express();

app.use(cors());
app.use(express.json());

// Serve the built React frontend (run `npm run build` in frontend/ first)
// so the whole app can be deployed as a single web service. In local dev
// you'll more likely run `npm run dev` in frontend/ instead (Vite's dev
// server on :5173, proxying /api to this server) — this static line is a
// no-op until frontend/dist exists, and Express just falls through to the
// API routes below.
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/departments', departmentsRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/salary-advances', salaryAdvancesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/audit-log', auditLogRouter);

// Central error handler.
// Database triggers reject invalid operations with SIGNAL SQLSTATE '45000'
// and a human-readable message (e.g. "Payroll rejected: employee is not
// ACTIVE"). mysql2 surfaces that as err.sqlState === '45000' with the
// message in err.sqlMessage — translate that into a clean 400 response
// instead of a generic 500.
app.use((err, req, res, next) => {
    console.error(err);

    if (err.sqlState === '45000') {
        return res.status(400).json({ error: err.sqlMessage });
    }
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A record with that unique value already exists' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ error: 'Referenced record does not exist' });
    }

    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Employee Payroll API listening on http://localhost:${PORT}`);
});
