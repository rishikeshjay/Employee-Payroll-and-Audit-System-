-- ============================================================
-- Employee Payroll and Audit System
-- 02_triggers.sql  -  Audit-log, salary-advance and payroll triggers
-- Run 01_schema.sql first.
-- ============================================================

USE employee_payroll_system;

DELIMITER $$

-- ============================================================
-- 1. EMPLOYEES: audit trail on every INSERT / UPDATE / DELETE
-- ============================================================

CREATE TRIGGER trg_employees_after_insert
AFTER INSERT ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, operation_type, record_id, old_data, new_data)
    VALUES (
        'employees', 'INSERT', NEW.employee_id, NULL,
        JSON_OBJECT(
            'employee_id', NEW.employee_id,
            'first_name', NEW.first_name, 'last_name', NEW.last_name,
            'email', NEW.email, 'department_id', NEW.department_id,
            'designation', NEW.designation, 'basic_salary', NEW.basic_salary,
            'hra', NEW.hra, 'allowances', NEW.allowances, 'status', NEW.status
        )
    );
END$$

CREATE TRIGGER trg_employees_after_update
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, operation_type, record_id, old_data, new_data)
    VALUES (
        'employees', 'UPDATE', NEW.employee_id,
        JSON_OBJECT(
            'first_name', OLD.first_name, 'last_name', OLD.last_name, 'email', OLD.email,
            'department_id', OLD.department_id, 'designation', OLD.designation,
            'basic_salary', OLD.basic_salary, 'hra', OLD.hra,
            'allowances', OLD.allowances, 'status', OLD.status
        ),
        JSON_OBJECT(
            'first_name', NEW.first_name, 'last_name', NEW.last_name, 'email', NEW.email,
            'department_id', NEW.department_id, 'designation', NEW.designation,
            'basic_salary', NEW.basic_salary, 'hra', NEW.hra,
            'allowances', NEW.allowances, 'status', NEW.status
        )
    );
END$$

-- BEFORE DELETE so OLD is still readable and the audit row is
-- written even if the delete is later rolled back as part of
-- the same transaction (both live/die together).
CREATE TRIGGER trg_employees_before_delete
BEFORE DELETE ON employees
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, operation_type, record_id, old_data, new_data)
    VALUES (
        'employees', 'DELETE', OLD.employee_id,
        JSON_OBJECT(
            'first_name', OLD.first_name, 'last_name', OLD.last_name, 'email', OLD.email,
            'department_id', OLD.department_id, 'designation', OLD.designation,
            'basic_salary', OLD.basic_salary, 'hra', OLD.hra,
            'allowances', OLD.allowances, 'status', OLD.status
        ),
        NULL
    );
END$$

-- ============================================================
-- 2. SALARY ADVANCES
--    - validates the request against a policy cap
--    - auto-computes installment_amount and balance_amount
--    - audits INSERT and UPDATE (e.g. approval, balance changes)
-- ============================================================

CREATE TRIGGER trg_salary_advance_before_insert
BEFORE INSERT ON salary_advances
FOR EACH ROW
BEGIN
    DECLARE v_basic       DECIMAL(12,2);
    DECLARE v_max_advance DECIMAL(12,2);
    DECLARE v_outstanding DECIMAL(12,2);

    SELECT basic_salary INTO v_basic
    FROM employees
    WHERE employee_id = NEW.employee_id;

    IF v_basic IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Salary advance rejected: employee not found';
    END IF;

    -- Policy: total outstanding advances may not exceed 3x basic salary
    SET v_max_advance = v_basic * 3;

    SELECT IFNULL(SUM(balance_amount), 0) INTO v_outstanding
    FROM salary_advances
    WHERE employee_id = NEW.employee_id
      AND status IN ('PENDING', 'APPROVED');

    IF (v_outstanding + NEW.advance_amount) > v_max_advance THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Salary advance rejected: exceeds 3x basic salary policy cap';
    END IF;

    IF NEW.installments IS NULL OR NEW.installments < 1 THEN
        SET NEW.installments = 1;
    END IF;

    -- Calculated fields: never trust caller-supplied values for these
    SET NEW.installment_amount = ROUND(NEW.advance_amount / NEW.installments, 2);
    SET NEW.balance_amount = NEW.advance_amount;
END$$

CREATE TRIGGER trg_salary_advance_after_insert
AFTER INSERT ON salary_advances
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, operation_type, record_id, old_data, new_data)
    VALUES (
        'salary_advances', 'INSERT', NEW.advance_id, NULL,
        JSON_OBJECT(
            'employee_id', NEW.employee_id, 'advance_amount', NEW.advance_amount,
            'installments', NEW.installments, 'installment_amount', NEW.installment_amount,
            'balance_amount', NEW.balance_amount, 'status', NEW.status
        )
    );
END$$

CREATE TRIGGER trg_salary_advance_after_update
AFTER UPDATE ON salary_advances
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (table_name, operation_type, record_id, old_data, new_data)
    VALUES (
        'salary_advances', 'UPDATE', NEW.advance_id,
        JSON_OBJECT('balance_amount', OLD.balance_amount, 'status', OLD.status),
        JSON_OBJECT('balance_amount', NEW.balance_amount, 'status', NEW.status)
    );
END$$

-- ============================================================
-- 3. PAYROLL
--    - blocks payroll for non-active employees
--    - pulls the oldest approved, outstanding salary advance and
--      applies its installment as a deduction automatically
--    - computes gross salary, a simple slab-based tax, total
--      deductions and net salary
--    - after the row is saved, reduces the advance balance and
--      marks it COMPLETED once fully repaid
-- ============================================================

CREATE TRIGGER trg_payroll_before_insert
BEFORE INSERT ON payroll
FOR EACH ROW
BEGIN
    DECLARE v_emp_status  VARCHAR(20);
    DECLARE v_advance_due DECIMAL(12,2) DEFAULT 0;
    DECLARE v_gross       DECIMAL(12,2);
    DECLARE v_tax         DECIMAL(12,2);

    SELECT status INTO v_emp_status
    FROM employees
    WHERE employee_id = NEW.employee_id;

    IF v_emp_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payroll rejected: employee not found';
    END IF;

    IF v_emp_status <> 'ACTIVE' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payroll rejected: employee is not ACTIVE';
    END IF;

    -- Oldest approved advance still carrying a balance
    SELECT installment_amount INTO v_advance_due
    FROM salary_advances
    WHERE employee_id = NEW.employee_id
      AND status = 'APPROVED'
      AND balance_amount > 0
    ORDER BY advance_date ASC
    LIMIT 1;

    IF v_advance_due IS NULL THEN
        SET v_advance_due = 0;
    END IF;

    SET v_gross = NEW.basic_salary + NEW.hra + NEW.allowances;

    -- Illustrative slab-based tax calculation (not real tax law)
    IF v_gross <= 25000 THEN
        SET v_tax = 0;
    ELSEIF v_gross <= 50000 THEN
        SET v_tax = v_gross * 0.05;
    ELSEIF v_gross <= 100000 THEN
        SET v_tax = v_gross * 0.10;
    ELSE
        SET v_tax = v_gross * 0.15;
    END IF;

    SET NEW.gross_salary      = v_gross;
    SET NEW.advance_deduction = v_advance_due;
    SET NEW.tax_deduction     = ROUND(v_tax, 2);
    SET NEW.total_deductions  = ROUND(v_tax + v_advance_due + IFNULL(NEW.other_deductions, 0), 2);
    SET NEW.net_salary        = ROUND(v_gross - NEW.total_deductions, 2);
END$$

CREATE TRIGGER trg_payroll_after_insert
AFTER INSERT ON payroll
FOR EACH ROW
BEGIN
    DECLARE v_advance_id      INT;
    DECLARE v_current_balance DECIMAL(12,2);

    -- Pay down the oldest outstanding advance by the amount just deducted.
    -- The advance_id and its pre-update balance are fetched into variables
    -- first: referencing balance_amount twice inside a single UPDATE's SET
    -- clause is unsafe in MySQL, since assignments are evaluated left to
    -- right and a later expression can see the already-updated value.
    IF NEW.advance_deduction > 0 THEN
        SELECT advance_id, balance_amount INTO v_advance_id, v_current_balance
        FROM salary_advances
        WHERE employee_id = NEW.employee_id
          AND status = 'APPROVED'
          AND balance_amount > 0
        ORDER BY advance_date ASC
        LIMIT 1;

        IF v_advance_id IS NOT NULL THEN
            UPDATE salary_advances
            SET balance_amount = v_current_balance - NEW.advance_deduction,
                status = IF((v_current_balance - NEW.advance_deduction) <= 0, 'COMPLETED', status)
            WHERE advance_id = v_advance_id;
        END IF;
    END IF;

    INSERT INTO audit_log (table_name, operation_type, record_id, old_data, new_data)
    VALUES (
        'payroll', 'INSERT', NEW.payroll_id, NULL,
        JSON_OBJECT(
            'employee_id', NEW.employee_id, 'pay_month', NEW.pay_month, 'pay_year', NEW.pay_year,
            'gross_salary', NEW.gross_salary, 'advance_deduction', NEW.advance_deduction,
            'tax_deduction', NEW.tax_deduction, 'total_deductions', NEW.total_deductions,
            'net_salary', NEW.net_salary
        )
    );
END$$

DELIMITER ;
