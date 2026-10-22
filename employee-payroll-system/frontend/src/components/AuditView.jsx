import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '../api.js';

export default function AuditView() {
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api('/audit-log?limit=200').then(setRows);
  }, []);

  return (
    <section className="view is-active">
      <header className="view-head">
        <h1>Audit log</h1>
      </header>
      <p className="hint">
        Every insert, update and delete on employees, salary advances and payroll is recorded automatically by database triggers. Click a row to see the before/after values.
      </p>

      <table className="ledger">
        <thead>
          <tr><th>ID</th><th>Table</th><th>Operation</th><th>Record</th><th>When</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr className="empty-row"><td colSpan="5">No audit activity yet.</td></tr>
          )}
          {rows.map(r => (
            <>
              <tr
                key={r.audit_id}
                className="audit-row"
                onClick={() => setExpanded(expanded === r.audit_id ? null : r.audit_id)}
              >
                <td>{r.audit_id}</td>
                <td>{r.table_name}</td>
                <td>{r.operation_type}</td>
                <td>#{r.record_id}</td>
                <td>{fmtDateTime(r.changed_at)}</td>
              </tr>
              {expanded === r.audit_id && (
                <tr className="audit-detail" key={`${r.audit_id}-detail`}>
                  <td colSpan="5">
                    Before: {JSON.stringify(r.old_data, null, 2) || 'null'}
                    {'\n\n'}
                    After: {JSON.stringify(r.new_data, null, 2) || 'null'}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </section>
  );
}
