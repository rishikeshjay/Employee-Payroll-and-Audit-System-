# Employee Payroll and Audit System

A MySQL 8+ / MariaDB database — plus a small full-stack app on top of it — that uses triggers to:
- keep an **audit log** of every insert/update/delete on `employees`, `salary_advances`, and `payroll`
- **auto-calculate** salary advance installments and running balances
- **auto-calculate** payroll (gross pay, tax, advance deduction, net pay) and automatically pay down outstanding advances

Everything here — the SQL, the API, and the UI — has been run and tested end-to-end, not just written.

## Project layout

```
employee-payroll-system/
├── 01_schema.sql          ─┐
├── 02_triggers.sql          } run these three in order to set up the database
├── 03_sample_data.sql      ─┘
├── 04_test_queries.sql       queries to inspect audit log / verify calculations
├── backend/                  Express REST API (Node.js) that talks to MySQL
│   ├── server.js
│   ├── db.js
│   ├── routes/
│   └── .env.example
└── frontend/                 React app (Vite) — the UI you add/edit data from
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── api.js
        ├── styles.css
        └── components/
```

You edit and add data from the **frontend** in the browser; it calls the
**backend** API; the backend writes to **MySQL**; the database triggers do
the audit logging and the salary/payroll math automatically. Nothing about
the calculation logic lives in the frontend or backend — it's all in the
triggers, so it can't be bypassed by calling the API "wrong."

## Data model

```
departments 1───* employees 1───* salary_advances
                       │
                       └──1───* payroll

audit_log  (generic — table_name + record_id identifies the source row)
```

- **employees**: personal/job info, `basic_salary`, `hra`, `allowances`, `status` (`ACTIVE`/`INACTIVE`/`TERMINATED`).
- **salary_advances**: a request for an advance. `installment_amount` and `balance_amount` are **not** supplied by you — a trigger computes them.
- **payroll**: one row per employee per pay period. `gross_salary`, `advance_deduction`, `tax_deduction`, `total_deductions`, `net_salary` are all computed by a trigger — you only supply `basic_salary`, `hra`, `allowances`, and optionally `other_deductions`.
- **audit_log**: `table_name`, `operation_type` (`INSERT`/`UPDATE`/`DELETE`), `record_id`, and `old_data`/`new_data` as JSON snapshots.

## What the triggers do

**Audit logging** (`employees`, `salary_advances`, `payroll`)
- `AFTER INSERT` / `AFTER UPDATE` write a JSON snapshot to `audit_log`.
- `BEFORE DELETE` on `employees` captures the row before it disappears.

**Salary advances** (`trg_salary_advance_before_insert`)
- Rejects the request (`SIGNAL SQLSTATE '45000'`) if the employee doesn't exist, or if total outstanding advances would exceed **3× basic salary** (a policy you can tune).
- Computes `installment_amount = advance_amount / installments` and sets `balance_amount = advance_amount`.

**Payroll** (`trg_payroll_before_insert` / `trg_payroll_after_insert`)
- Rejects payroll generation for employees who aren't `ACTIVE`.
- Looks up the employee's oldest `APPROVED` advance with a remaining balance and pulls its `installment_amount` in as `advance_deduction` — no manual lookup needed.
- Computes `gross_salary`, a simple slab-based `tax_deduction` (edit the `IF`/`ELSEIF` block to match real tax rules), `total_deductions`, and `net_salary`.
- After the payroll row is saved, reduces that advance's `balance_amount` and flips it to `COMPLETED` once fully repaid.

> Note on a MySQL quirk this project deliberately works around: in a single `UPDATE ... SET a = expr1, b = expr2`, later expressions can see columns already updated earlier in the same statement (assignments run left-to-right). `trg_payroll_after_insert` fetches the advance's balance into a variable **before** updating, rather than referencing `balance_amount` twice in one `SET` clause, to avoid marking an advance `COMPLETED` too early.

## Running it locally in VS Code

### 1. Install and start MySQL/MariaDB

```bash
sudo apt update
sudo apt install mariadb-server mariadb-client
sudo service mariadb start
```

### 2. Load the database

```bash
cd employee-payroll-system
mysql -u root -p < 01_schema.sql
mysql -u root -p < 02_triggers.sql
mysql -u root -p < 03_sample_data.sql
```

(Optional, in VS Code: install the **SQLTools** extension + its MySQL/MariaDB
driver to browse tables and run these files with one click instead of the
terminal.)

### 3. Database user for the API

The Node driver connects over **TCP**, not the local socket `mysql -u root`
uses — so on most fresh installs `root` will be rejected even though the
terminal client works fine. Create a dedicated app user instead:

```sql
CREATE USER 'payroll_app'@'127.0.0.1' IDENTIFIED BY 'choose_a_password';
GRANT ALL PRIVILEGES ON employee_payroll_system.* TO 'payroll_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### 4. Configure and start the backend

```bash
cd backend
cp .env.example .env      # edit DB_PASSWORD to match what you set above
npm install
npm start                 # → http://localhost:3000
```

`npm run dev` restarts automatically on file changes (uses Node's built-in `--watch`).

### 5. Run the frontend

**Option A — development mode** (hot reload, recommended while building/editing):

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
```

Vite's dev server proxies `/api` calls to the backend on `:3000` (configured
in `vite.config.js`), so keep the backend running in another terminal. Open
**http://localhost:5173** — this is what you'll edit and see change live.

**Option B — production build**, served by the backend itself (what you'd
deploy):

```bash
cd frontend
npm install
npm run build         # outputs to frontend/dist
```

Then just open **http://localhost:3000** — the backend already serves
`frontend/dist` as static files, so once it's built there's no separate
frontend server needed at all.

## Using the app

- **Employees** — add, edit, delete. Deleting cascades to that employee's advances/payroll rows and still logs the delete itself to `audit_log` first.
- **Salary advances** — request one (amount + installments); it starts `PENDING`. Click **Approve** to make it eligible for automatic payroll deduction. Try requesting more than 3× an employee's basic salary to see the trigger's policy cap reject it right in the form.
- **Payroll** — pick an employee and a period; basic/HRA/allowances are pulled from their record automatically, and gross pay, tax, any outstanding advance installment, and net pay are all computed by the trigger. Generating payroll for a non-`ACTIVE` employee is rejected the same way.
- **Audit log** — click any row to expand the before/after JSON snapshot.

## Trying the guard rails

Two intentional failure cases are commented out in `03_sample_data.sql` / `04_test_queries.sql` — uncomment either to see the trigger reject the statement:

```sql
-- Breaches the 3x-basic-salary advance cap
INSERT INTO salary_advances (employee_id, advance_amount, installments) VALUES (1, 500000, 1);
-- ERROR 1644 (45000): Salary advance rejected: exceeds 3x basic salary policy cap

-- Payroll for a non-ACTIVE employee
INSERT INTO payroll (employee_id, pay_month, pay_year, basic_salary) VALUES (<inactive_emp_id>, 9, 2026, 50000);
-- ERROR 1644 (45000): Payroll rejected: employee is not ACTIVE
```

## Deploying it

Because the backend serves the built frontend as static files, you only have
to deploy **one web service** plus a **MySQL database** — you don't need
separate frontend hosting.

**Suggested free/cheap path:**

1. **Database:** create a managed MySQL instance — [Railway](https://railway.app), [Aiven](https://aiven.io), or [PlanetScale](https://planetscale.com) (note: PlanetScale doesn't support `SIGNAL`/stored routines on some plans — check current limits before choosing it) all work. Run `01_schema.sql`, `02_triggers.sql`, and optionally `03_sample_data.sql` against it, the same way you did locally, just pointing `mysql` at the remote host.
2. **Backend + frontend:** deploy this whole repo to [Render](https://render.com), [Railway](https://railway.app), or [Fly.io](https://fly.io) with:
   - Build command: `npm install --prefix backend && npm install --prefix frontend && npm run build --prefix frontend`
   - Start command: `npm start --prefix backend`
   - Environment variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (from step 1) and `PORT` (most platforms set this for you automatically — leave it out and the app will pick up their value).
3. Open the URL the platform gives you — that's your live app, database and all.

**Docker alternative**, if you'd rather self-host (a VM, a Pi, etc.):

```dockerfile
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist ../frontend/dist
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run it alongside a `mysql:8` container (or point it at any
already-running MySQL server) with the same environment variables as above.

## Extending this

- Swap the flat tax slabs in `trg_payroll_before_insert` for a real tax table.
- Add a `department_id`-based deduction (e.g. PF/insurance) by joining `departments` in the trigger.
- Add an `approved_by`/role check before allowing `status = 'APPROVED'` updates on `salary_advances`.
- Add real authentication (the API currently has none — anyone who can reach it can read/write everything) before deploying this somewhere public. A simple starting point: an API key or JWT check in `backend/server.js`'s middleware, or a hosted auth provider.
- On the frontend, if the app grows, `react-router-dom` for real URL-based routing (currently tabs are just component state) or `@tanstack/react-query` for caching/refetching are natural next additions.
- If you'd rather run the database on PostgreSQL, the trigger logic ports directly — replace `DELIMITER`/`SIGNAL SQLSTATE` blocks with `CREATE FUNCTION ... RETURNS TRIGGER` + `RAISE EXCEPTION`, and `JSON_OBJECT(...)` with `jsonb_build_object(...)`. Ask if you'd like a Postgres version.
