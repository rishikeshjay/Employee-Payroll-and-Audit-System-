-- ============================================================
-- Employee Payroll and Audit System
-- 04_test_queries.sql  -  Verification queries
-- Run after 01_schema.sql, 02_triggers.sql, 03_sample_data.sql
-- ============================================================

USE employee_payroll_system;

-- 1. Full audit trail, newest first
SELECT audit_id, table_name, operation_type, record_id, old_data, new_data, changed_at
FROM audit_log
ORDER BY audit_id DESC;

-- 2. Audit trail for a single employee's record (change history)
SELECT operation_type, old_data, new_data, changed_at
FROM audit_log
WHERE table_name = 'employees' AND record_id = 1
ORDER BY audit_id;

-- 3. Salary advances with computed installment/balance amounts
SELECT advance_id, employee_id, advance_amount, installments,
       installment_amount, balance_amount, status
FROM salary_advances;

-- 4. Payroll register with all computed fields
SELECT p.payroll_id, e.first_name, e.last_name, p.pay_month, p.pay_year,
       p.gross_salary, p.advance_deduction, p.tax_deduction,
       p.total_deductions, p.net_salary
FROM payroll p
JOIN employees e ON e.employee_id = p.employee_id
ORDER BY p.pay_year, p.pay_month, e.last_name;

-- 5. Confirm the advance balance dropped after each payroll run
SELECT advance_id, employee_id, advance_amount, installment_amount, balance_amount, status
FROM salary_advances
WHERE employee_id = 1;

-- 6. Attempt a payroll run for an INACTIVE employee to see the guard trigger fire.
--    Expect: ERROR 1644 (45000): Payroll rejected: employee is not ACTIVE
-- INSERT INTO employees (first_name, last_name, email, department_id, designation, basic_salary, date_of_joining, status)
-- VALUES ('Inactive', 'Person', 'inactive.person@example.com', 1, 'Tester', 50000, '2024-01-01', 'INACTIVE');
-- INSERT INTO payroll (employee_id, pay_month, pay_year, basic_salary)
-- VALUES (LAST_INSERT_ID(), 9, 2026, 50000);

-- 7. Attempt to breach the 3x-basic-salary advance cap.
--    Expect: ERROR 1644 (45000): Salary advance rejected: exceeds 3x basic salary policy cap
-- INSERT INTO salary_advances (employee_id, advance_amount, installments) VALUES (1, 500000, 1);
