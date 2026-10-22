const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/salary-advances?employee_id=1
router.get('/', async (req, res, next) => {
    try {
        const { employee_id } = req.query;
        let sql = `
            SELECT sa.*, e.first_name, e.last_name
            FROM salary_advances sa
            JOIN employees e ON e.employee_id = sa.employee_id
        `;
        const params = [];
        if (employee_id) {
            sql += ' WHERE sa.employee_id = ?';
            params.push(employee_id);
        }
        sql += ' ORDER BY sa.advance_id DESC';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/salary-advances
// Only employee_id, advance_amount and installments are needed —
// installment_amount and balance_amount are computed by the
// trg_salary_advance_before_insert trigger in the database.
router.post('/', async (req, res, next) => {
    try {
        const { employee_id, advance_amount, installments } = req.body;

        if (!employee_id || !advance_amount) {
            return res.status(400).json({ error: 'employee_id and advance_amount are required' });
        }

        const [result] = await pool.query(
            'INSERT INTO salary_advances (employee_id, advance_amount, installments) VALUES (?, ?, ?)',
            [employee_id, advance_amount, installments || 1]
        );

        const [rows] = await pool.query('SELECT * FROM salary_advances WHERE advance_id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// PUT /api/salary-advances/:id/status
// Approve or reject a request. Body: { status: 'APPROVED' | 'REJECTED', approved_by }
router.put('/:id/status', async (req, res, next) => {
    try {
        const { status, approved_by } = req.body;
        if (!['APPROVED', 'REJECTED', 'PENDING', 'COMPLETED'].includes(status)) {
            return res.status(400).json({ error: 'status must be one of PENDING, APPROVED, REJECTED, COMPLETED' });
        }

        const [result] = await pool.query(
            'UPDATE salary_advances SET status = ?, approved_by = ? WHERE advance_id = ?',
            [status, approved_by || null, req.params.id]
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Salary advance not found' });

        const [rows] = await pool.query('SELECT * FROM salary_advances WHERE advance_id = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
