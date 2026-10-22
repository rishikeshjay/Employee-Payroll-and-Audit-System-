import { useEffect, useState, useCallback } from 'react';
import { api, money, MONTHS } from '../api.js';

const now = new Date();

export default function PayrollView({ employees, onGenerated }) {
  const [rows, setRows] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: '', pay_month: now.getMonth() + 1, pay_year: now.getFullYear(), other_deductions: 0
  });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api('/payroll');
    setRows(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ employee_id: '', pay_month: now.getMonth() + 1, pay_year: now.getFullYear(), other_deductions: 0 });
    setError('');
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      // basic_salary/hra/allowances aren't sent — the backend pulls them
      // from the employee's current record, and gross pay, tax, advance
      // deduction and net pay are all computed by trg_payroll_before_insert.
      await api('/payroll', { method: 'POST', body: JSON.stringify(form) });
      setFormOpen(false);
      await load();
      onGenerated?.(); // an outstanding advance balance may have just changed
    } catch (err) {
      setError(err.message); // e.g. "Payroll rejected: employee is not ACTIVE"
    }
  }

  return (
    <section className="view is-active">
      <header className="view-head">
        <h1>Payroll</h1>
        <button className="btn btn-accent" onClick={openNew}>Generate payslip</button>
      </header>

      {formOpen && (
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <label>Employee
            <select
              value={form.employee_id}
              onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              required
            >
              <option value="">Select…</option>
              {employees.map(emp => (
                <option key={emp.employee_id} value={emp.employee_id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </label>
          <label>Month
            <input
              type="number" min="1" max="12" required
              value={form.pay_month}
              onChange={e => setForm(f => ({ ...f, pay_month: e.target.value }))}
            />
          </label>
          <label>Year
            <input
              type="number" min="2000" required
              value={form.pay_year}
              onChange={e => setForm(f => ({ ...f, pay_year: e.target.value }))}
            />
          </label>
          <label>Other deductions
            <input
              type="number" step="0.01"
              value={form.other_deductions}
              onChange={e => setForm(f => ({ ...f, other_deductions: e.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-accent">Generate</button>
            <button type="button" className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </form>
      )}

      <p className="hint">
        Basic pay, HRA and allowances are pulled from the employee record; gross pay, tax, advance deduction and net pay are all calculated by the database trigger.
      </p>

      <table className="ledger">
        <thead>
          <tr>
            <th>ID</th><th>Employee</th><th>Period</th>
            <th className="num">Gross</th><th className="num">Advance ded.</th>
            <th className="num">Tax</th><th className="num">Net pay</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="empty-row"><td colSpan="7">No payroll runs yet.</td></tr>
          )}
          {rows.map(p => (
            <tr key={p.payroll_id}>
              <td>{p.payroll_id}</td>
              <td>{p.first_name} {p.last_name}</td>
              <td>{MONTHS[p.pay_month]} {p.pay_year}</td>
              <td className="num">{money(p.gross_salary)}</td>
              <td className="num">{money(p.advance_deduction)}</td>
              <td className="num">{money(p.tax_deduction)}</td>
              <td className="num">{money(p.net_salary)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
