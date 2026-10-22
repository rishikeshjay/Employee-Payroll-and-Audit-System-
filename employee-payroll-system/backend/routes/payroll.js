const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/payroll?employee_id=1
router.get('/', async (req, res, next) => {
    try {
        const { employee_id } = req.query;
        let sql = `
            SELECT p.*, e.first_name, e.last_name
            FROM payroll p
            JOIN employees e ON e.employee_id = p.employee_id
        `;
        const params = [];
        if (employee_id) {
            sql += ' WHERE p.employee_id = ?';
            params.push(employee_id);
        }
        sql += ' ORDER BY p.pay_year DESC, p.pay_month DESC, e.last_name';

        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/payroll
// Body: { employee_id, pay_month, pay_year, other_deductions? }
// basic_salary / hra / allowances are pulled from the employee's
// current record automatically; gross/tax/advance-deduction/net are
// computed by trg_payroll_before_insert in the database.
router.post('/', async (req, res, next) => {
    try {
        const { employee_id, pay_month, pay_year, other_deductions } = req.body;

        if (!employee_id || !pay_month || !pay_year) {
            return res.status(400).json({ error: 'employee_id, pay_month and pay_year are required' });
        }

        const [empRows] = await pool.query(
            'SELECT basic_salary, hra, allowances FROM employees WHERE employee_id = ?',
            [employee_id]
        );
        if (empRows.length === 0) return res.status(404).json({ error: 'Employee not found' });

        const { basic_salary, hra, allowances } = empRows[0];

        const [result] = await pool.query(
            `INSERT INTO payroll (employee_id, pay_month, pay_year, basic_salary, hra, allowances, other_deductions)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employee_id, pay_month, pay_year, basic_salary, hra, allowances, other_deductions || 0]
        );

        const [rows] = await pool.query('SELECT * FROM payroll WHERE payroll_id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
