const NAV_ITEMS = [
  { id: 'employees', label: 'Employees' },
  { id: 'advances', label: 'Salary advances' },
  { id: 'payroll', label: 'Payroll' },
  { id: 'audit', label: 'Audit log' }
];

export default function Sidebar({ activeView, onSelectView, connStatus }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">§</span>
        <div>
          <div className="brand-name">Ledger</div>
          <div className="brand-sub">Payroll &amp; audit</div>
        </div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'is-active' : ''}`}
            onClick={() => onSelectView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className={`conn-status ${connStatus}`}>
        <span className="dot" />
        <span>{connStatus === 'ok' ? 'API connected' : connStatus === 'err' ? 'API unreachable' : 'Checking API…'}</span>
      </div>
    </aside>
  );
}
