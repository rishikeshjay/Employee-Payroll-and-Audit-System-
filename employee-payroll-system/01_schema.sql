-- ============================================================
-- Employee Payroll and Audit System
-- 01_schema.sql  -  Database + table definitions
-- Target: MySQL 8.0+
-- ============================================================

DROP DATABASE IF EXISTS employee_payroll_system;
CREATE DATABASE employee_payroll_system;
USE employee_payroll_system;

-- ------------------------------------------------------------
-- Departments
-- ------------------------------------------------------------
CREATE TABLE departments (
    department_id   INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Employees
-- ------------------------------------------------------------
CREATE TABLE employees (
    employee_id      INT AUTO_INCREMENT PRIMARY KEY,
    first_name       VARCHAR(50)  NOT NULL,
    last_name        VARCHAR(50)  NOT NULL,
    email            VARCHAR(100) NOT NULL UNIQUE,
    phone            VARCHAR(20),
    department_id    INT,
    designation      VARCHAR(50),
    basic_salary     DECIMAL(12,2) NOT NULL CHECK (basic_salary >= 0),
    hra              DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
    allowances       DECIMAL(12,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
    date_of_joining  DATE NOT NULL,
    status           ENUM('ACTIVE','INACTIVE','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_employees_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- Salary advances
-- installment_amount and balance_amount are computed by trigger,
-- not supplied by the caller.
-- ------------------------------------------------------------
CREATE TABLE salary_advances (
    advance_id          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id         INT NOT NULL,
    advance_amount       DECIMAL(12,2) NOT NULL CHECK (advance_amount > 0),
    advance_date         DATE NOT NULL DEFAULT (CURRENT_DATE),
    installments         INT NOT NULL DEFAULT 1 CHECK (installments >= 1),
    installment_amount   DECIMAL(12,2),
    balance_amount        DECIMAL(12,2),
    status                ENUM('PENDING','APPROVED','REJECTED','COMPLETED') NOT NULL DEFAULT 'PENDING',
    approved_by           VARCHAR(100),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_advance_employee
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Payroll
-- gross_salary, advance_deduction, tax_deduction, total_deductions
-- and net_salary are all computed by trigger at insert time.
-- ------------------------------------------------------------
CREATE TABLE payroll (
    payroll_id         INT AUTO_INCREMENT PRIMARY KEY,
    employee_id        INT NOT NULL,
    pay_month          TINYINT NOT NULL CHECK (pay_month BETWEEN 1 AND 12),
    pay_year           SMALLINT NOT NULL,
    basic_salary       DECIMAL(12,2) NOT NULL,
    hra                DECIMAL(12,2) NOT NULL DEFAULT 0,
    allowances         DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross_salary       DECIMAL(12,2),
    advance_deduction  DECIMAL(12,2) DEFAULT 0,
    tax_deduction      DECIMAL(12,2) DEFAULT 0,
    other_deductions   DECIMAL(12,2) DEFAULT 0,
    total_deductions   DECIMAL(12,2),
    net_salary         DECIMAL(12,2),
    status             ENUM('GENERATED','PAID') NOT NULL DEFAULT 'GENERATED',
    generated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_payroll_employee
        FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_payroll_period UNIQUE (employee_id, pay_month, pay_year)
);

-- ------------------------------------------------------------
-- Audit log
-- Generic table that every trigger writes into.
-- old_data / new_data store a JSON snapshot of the relevant columns.
-- ------------------------------------------------------------
CREATE TABLE audit_log (
    audit_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    table_name      VARCHAR(50) NOT NULL,
    operation_type  ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    record_id       INT NOT NULL,
    old_data        JSON,
    new_data        JSON,
    changed_by      VARCHAR(100) DEFAULT (CURRENT_USER()),
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_table_record (table_name, record_id)
);
