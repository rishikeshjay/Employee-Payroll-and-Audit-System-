import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import Sidebar from './components/Sidebar.jsx';
import EmployeesView from './components/EmployeesView.jsx';
import AdvancesView from './components/AdvancesView.jsx';
import PayrollView from './components/PayrollView.jsx';
import AuditView from './components/AuditView.jsx';

export default function App() {
  const [activeView, setActiveView] = useState('employees');
  const [connStatus, setConnStatus] = useState('checking');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);

  const loadEmployees = useCallback(async () => {
    setEmployees(await api('/employees'));
  }, []);

  useEffect(() => {
    api('/health').then(() => setConnStatus('ok')).catch(() => setConnStatus('err'));
    api('/departments').then(setDepartments);
    loadEmployees();
  }, [loadEmployees]);

  return (
    <div className="app">
      <Sidebar activeView={activeView} onSelectView={setActiveView} connStatus={connStatus} />
      <main className="content">
        {activeView === 'employees' && (
          <EmployeesView employees={employees} departments={departments} onChanged={loadEmployees} />
        )}
        {activeView === 'advances' && (
          <AdvancesView employees={employees} onBalanceChanged={loadEmployees} />
        )}
        {activeView === 'payroll' && (
          <PayrollView employees={employees} onGenerated={loadEmployees} />
        )}
        {activeView === 'audit' && <AuditView />}
      </main>
    </div>
  );
}
