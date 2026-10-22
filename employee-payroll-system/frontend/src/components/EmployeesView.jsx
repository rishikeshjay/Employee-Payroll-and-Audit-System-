import { useState } from 'react';
import { api, money } from '../api.js';
import Pill from './Pill.jsx';

const BLANK = {
  employee_id: '', first_name: '', last_name: '', email: '', phone: '',
  department_id: '', designation: '', basic_salary: '', hra: 0, allowances: 0,
  date_of_joining: '', status: 'ACTIVE'
};

export default function EmployeesView({ employees, departments, onChanged }) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState('');

  function openNew() {
    setForm(BLANK);
    setError('');
    setFormOpen(true);
  }

  function openEdit(emp) {
    setForm({
      employee_id: emp.employee_id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email,
      phone: emp.phone || '',
      department_id: emp.department_id || '',
      designation: emp.designation || '',
      basic_salary: emp.basic_salary,
      hra: emp.hra,
      allowances: emp.allowances,
      date_of_joining: (emp.date_of_joining || '').slice(0, 10),
      status: emp.status
    });
    setError('');
    setFormOpen(true);
  }

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const { employee_id, ...data } = form;
    try {
      if (employee_id) {
        await api(`/employees/${employee_id}`, { method: 'PUT', body: JSON.stringify(data) });
      } else {
        await api('/employees', { method: 'POST', body: JSON.stringify(data) });
      }
      setFormOpen(false);
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this employee? This cannot be undone.')) return;
    try {
      await api(`/employees/${id}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <section className="view is-active">
      <header className="view-head">
        <h1>Employees</h1>
        <button className="btn btn-accent" onClick={openNew}>New employee</button>
      </header>

      {formOpen && (
        <form className="panel form-grid" onSubmit={handleSubmit}>
          <label>First name
            <input value={form.first_name} onChange={e => update('first_name', e.target.value)} required />
          </label>
          <label>Last name
            <input value={form.last_name} onChange={e => update('last_name', e.target.value)} required />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={e => update('email', e.target.value)} required />
          </label>
          <label>Phone
            <input value={form.phone} onChange={e => update('phone', e.target.value)} />
          </label>
          <label>Department
            <select value={form.department_id} onChange={e => update('department_id', e.target.value)}>
              <option value="">—</option>
              {departments.map(d => (
                <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
              ))}
            </select>
          </label>
          <label>Designation
            <input value={form.designation} onChange={e => update('designation', e.target.value)} />
          </label>
          <label>Basic salary
            <input type="number" step="0.01" value={form.basic_salary} onChange={e => update('basic_salary', e.target.value)} required />
          </label>
          <label>HRA
            <input type="number" step="0.01" value={form.hra} onChange={e => update('hra', e.target.value)} />
          </label>
          <label>Allowances
            <input type="number" step="0.01" value={form.allowances} onChange={e => update('allowances', e.target.value)} />
          </label>
          <label>Date of joining
            <input type="date" value={form.date_of_joining} onChange={e => update('date_of_joining', e.target.value)} required />
          </label>
          <label>Status
            <select value={form.status} onChange={e => update('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-accent">Save employee</button>
            <button type="button" className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
          {error && <p className="form-error">{error}</p>}
        </form>
      )}

      <table className="ledger">
        <thead>
          <tr>
            <th>ID</th><th>Name</th><th>Department</th><th>Designation</th>
            <th className="num">Basic</th><th className="num">HRA</th><th className="num">Allowances</th>
            <th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 && (
            <tr className="empty-row"><td colSpan="9">No employees yet — add one to get started.</td></tr>
          )}
          {employees.map(e => (
            <tr key={e.employee_id}>
              <td>{e.employee_id}</td>
              <td>{e.first_name} {e.last_name}</td>
              <td>{e.department_name || '—'}</td>
              <td>{e.designation || '—'}</td>
              <td className="num">{money(e.basic_salary)}</td>
              <td className="num">{money(e.hra)}</td>
              <td className="num">{money(e.allowances)}</td>
              <td><Pill value={e.status} /></td>
              <td>
                <button className="btn btn-small" onClick={() => openEdit(e)}>Edit</button>{' '}
                <button className="btn btn-small btn-danger" onClick={() => handleDelete(e.employee_id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
