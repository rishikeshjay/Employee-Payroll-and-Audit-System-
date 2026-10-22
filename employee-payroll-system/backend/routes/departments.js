const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/departments
router.get('/', async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT * FROM departments ORDER BY department_name');
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
