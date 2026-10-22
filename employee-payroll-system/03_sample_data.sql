-- ============================================================
-- Employee Payroll and Audit System
-- 03_sample_data.sql  -  Sample data
-- Run 01_schema.sql and 02_triggers.sql first.
-- ============================================================

USE employee_payroll_system;

INSERT INTO departments (department_name) VALUES
    ('Engineering'), ('Human Resources'), ('Finance'), ('Sales');

-- Each insert below fires trg_employees_after_insert
INSERT INTO employees (first_name, last_name, email, phone, department_id, designation, basic_salary, hra, allowances, date_of_joining)
VALUES
    ('Asha', 'Rao', 'asha.rao@example.com', '9000000001', 1, 'Software Engineer', 60000, 12000, 5000, '2023-01-10'),
    ('Vikram', 'Nair', 'vikram.nair@example.com', '9000000002', 1, 'Senior Engineer', 95000, 15000, 8000, '2021-06-01'),
    ('Priya', 'Menon', 'priya.menon@example.com', '9000000003', 2, 'HR Manager', 70000, 12000, 4000, '2020-03-15'),
    ('Rahul', 'Iyer', 'rahul.iyer@example.com', '9000000004', 3, 'Accountant', 45000, 9000, 3000, '2022-11-20');

-- This UPDATE fires trg_employees_after_update
UPDATE employees
SET basic_salary = 65000, allowances = 6000
WHERE email = 'asha.rao@example.com';

-- ------------------------------------------------------------
-- Salary advance requests
-- installment_amount / balance_amount are computed by the trigger,
-- not supplied here.
-- ------------------------------------------------------------
INSERT INTO salary_advances (employee_id, advance_amount, installments)
VALUES
    (1, 30000, 3),   -- Asha requests 30,000 over 3 installments
    (4, 20000, 2);   -- Rahul requests 20,000 over 2 installments

-- Approve the advances (fires trg_salary_advance_after_update)
UPDATE salary_advances SET status = 'APPROVED', approved_by = 'hr.admin' WHERE advance_id = 1;
UPDATE salary_advances SET status = 'APPROVED', approved_by = 'hr.admin' WHERE advance_id = 2;

-- Try to breach the 3x-basic-salary cap on purpose to demonstrate the guard.
-- Uncomment to see it raise SQLSTATE 45000:
-- INSERT INTO salary_advances (employee_id, advance_amount, installments) VALUES (1, 500000, 1);

-- ------------------------------------------------------------
-- Payroll runs
-- gross_salary, deductions and net_salary are all computed by
-- trg_payroll_before_insert; the advance installment (if any
-- approved advance is outstanding) is applied automatically.
-- ------------------------------------------------------------
INSERT INTO payroll (employee_id, pay_month, pay_year, basic_salary, hra, allowances, other_deductions)
VALUES
    (1, 9, 2026, 65000, 12000, 6000, 0),   -- Asha: advance installment auto-applied
    (2, 9, 2026, 95000, 15000, 8000, 0),   -- Vikram: no outstanding advance
    (3, 9, 2026, 70000, 12000, 4000, 500), -- Priya: has a small manual deduction
    (4, 9, 2026, 45000, 9000, 3000, 0);    -- Rahul: advance installment auto-applied

-- Run payroll for Asha a second month to see the advance balance
-- go down again and the deduction still applying.
INSERT INTO payroll (employee_id, pay_month, pay_year, basic_salary, hra, allowances, other_deductions)
VALUES (1, 10, 2026, 65000, 12000, 6000, 0);

-- Delete an employee to demonstrate trg_employees_before_delete.
-- (Requires no FK references left; here we just show it against
-- a throwaway row so we don't disturb the payroll/advance demo data.)
INSERT INTO employees (first_name, last_name, email, department_id, designation, basic_salary, hra, allowances, date_of_joining, status)
VALUES ('Temp', 'Contractor', 'temp.contractor@example.com', 4, 'Contractor', 30000, 0, 0, '2026-08-01', 'INACTIVE');

DELETE FROM employees WHERE email = 'temp.contractor@example.com';
