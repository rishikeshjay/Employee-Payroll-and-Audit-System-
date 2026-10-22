import { useEffect, useState, useCallback } from 'react';
import { api, money } from '../api.js';
import Pill from './Pill.jsx';

export default function AdvancesView({ employees, onBalanceChanged }) {
  const [advances, setAdvances] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: '', advance_amount: '', installments: 1 });
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const rows = await api('/salary-advances');
    setAdvances(rows);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ employee_id: '', advance_amount: '', installments: 1 });
    setError('');
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      // installment_amount and balance_amount are NOT sent — the
      // trg_salary_advance_before_insert trigger computes both and
      // rejects the request outright if it breaches the 3x-basic-salary cap.
      await api('/salary-advances', { method: 'POST', body: JSON.stringify(form) });
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(id, status) {
    try {
      await api(`/salary-advances/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, approved_by: 'web-ui' })
      });
      await load();
      onBalanceChanged?.();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="view is-active">
      <header className="view-head">
        <h1>Salary advances</h1>
        <button className="btn btn-accent" onClick={openNew}>Request advance</button>
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
          <label>Advance amount
            <input
              type="number" step="0.01" required
              value={form.advance_amount}
              onChange={e => setForm(f => ({ ...f, advance_amount: e.target.value }))}
            />
          </label>
          <label>Installments
            <input
              type="number" min="1" required
              value={form.installments}
              onChange={e => setForm(f => ({ ...f, installments: e.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-accent">Submit request</button>
            <button type="button" className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </form>
      )}

      <p className="hint">
        Installment amount and remaining balance are calculated automatically by the database trigger — they're not entered here.
      </p>

      <table className="ledger">
        <thead>
          <tr>
            <th>ID</th><th>Employee</th><th className="num">Amount</th><th className="num">Installments</th>
            <th className="num">Per installment</th><th className="num">Balance left</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {advances.length === 0 && (
            <tr className="empty-row"><td colSpan="8">No salary advance requests yet.</td></tr>
          )}
          {advances.map(a => (
            <tr key={a.advance_id}>
              <td>{a.advance_id}</td>
              <td>{a.first_name} {a.last_name}</td>
              <td className="num">{money(a.advance_amount)}</td>
              <td className="num">{a.installments}</td>
              <td className="num">{money(a.installment_amount)}</td>
              <td className="num">{money(a.balance_amount)}</td>
              <td><Pill value={a.status} /></td>
              <td>
                {a.status === 'PENDING' && (
                  <>
                    <button className="btn btn-small" onClick={() => setStatus(a.advance_id, 'APPROVED')}>Approve</button>{' '}
                    <button className="btn btn-small btn-danger" onClick={() => setStatus(a.advance_id, 'REJECTED')}>Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
