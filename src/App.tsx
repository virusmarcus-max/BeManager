import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import DashboardPage from './pages/Dashboard';
import EmployeesPage from './pages/Employees';
import SchedulePage from './pages/Schedule';
import SettingsPage from './pages/Settings';
import SupervisionPage from './pages/Supervision';
import ManagerLivePage from './pages/ManagerLive';

import SupervisorLivePage from './pages/SupervisorLive';
import TasksPage from './pages/Tasks';
import IncentivesManager from './pages/IncentivesManager';
import IncentivesSupervisor from './pages/IncentivesSupervisor';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<DashboardPage />} />
                <Route path="manager-live" element={<ManagerLivePage />} />
                <Route path="employees" element={<EmployeesPage />} />
                <Route path="schedule" element={<SchedulePage />} />
                <Route path="supervision" element={<SupervisionPage />} />
                <Route path="supervision/incentives" element={<IncentivesSupervisor />} />
                <Route path="approvals" element={<SupervisionPage />} />
                <Route path="live" element={<SupervisorLivePage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="incentives" element={<IncentivesManager />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </StoreProvider>
    </AuthProvider>
  );
}
