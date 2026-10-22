const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/employees  - list, with department name joined in
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT e.*, d.department_name
            FROM employees e
            LEFT JOIN departments d ON d.department_id = e.department_id
            ORDER BY e.employee_id
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// GET /api/employees/:id
router.get('/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT e.*, d.department_name
             FROM employees e
             LEFT JOIN departments d ON d.department_id = e.department_id
             WHERE e.employee_id = ?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// POST /api/employees
router.post('/', async (req, res, next) => {
    try {
        const {
            first_name, last_name, email, phone, department_id,
            designation, basic_salary, hra, allowances, date_of_joining, status
        } = req.body;

        if (!first_name || !last_name || !email || !basic_salary || !date_of_joining) {
            return res.status(400).json({
                error: 'first_name, last_name, email, basic_salary and date_of_joining are required'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO employees
                (first_name, last_name, email, phone, department_id, designation,
                 basic_salary, hra, allowances, date_of_joining, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [first_name, last_name, email, phone || null, department_id || null,
             designation || null, basic_salary, hra || 0, allowances || 0,
             date_of_joining, status || 'ACTIVE']
        );

        const [rows] = await pool.query('SELECT * FROM employees WHERE employee_id = ?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// PUT /api/employees/:id  - partial update
router.put('/:id', async (req, res, next) => {
    try {
        const fields = [
            'first_name', 'last_name', 'email', 'phone', 'department_id',
            'designation', 'basic_salary', 'hra', 'allowances', 'date_of_joining', 'status'
        ];
        const updates = [];
        const values = [];

        for (const field of fields) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(req.body[field]);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updatable fields provided' });
        }

        values.push(req.params.id);
        const [result] = await pool.query(
            `UPDATE employees SET ${updates.join(', ')} WHERE employee_id = ?`,
            values
        );

        if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });

        const [rows] = await pool.query('SELECT * FROM employees WHERE employee_id = ?', [req.params.id]);
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// DELETE /api/employees/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const [result] = await pool.query('DELETE FROM employees WHERE employee_id = ?', [req.params.id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
