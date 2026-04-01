import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Members = lazy(() => import('./pages/Members'));
const FineTypes = lazy(() => import('./pages/FineTypes'));
const Fines = lazy(() => import('./pages/Fines'));
const Statistics = lazy(() => import('./pages/Statistics'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-stone-400 text-sm">Laden...</div>
  </div>
);

// Redirect based on role
const RoleBasedRedirect = () => {
  const { isMitglied, isVorstand } = useAuth();
  // Mitglied oder Vorstand -> Dashboard (eigene Übersicht)
  if (isMitglied || isVorstand) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

// Vorstand und Mitglied sehen persönliches Dashboard
const DashboardRoute = ({ children }) => {
  return children;
};

// Routes that mitglied cannot access
const NoMitgliedRoute = ({ children }) => {
  const { isMitglied } = useAuth();
  if (isMitglied) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// Only admin can access
const AdminRoute = ({ children }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RoleBasedRedirect />} />
              <Route path="dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
              <Route path="members" element={<NoMitgliedRoute><Members /></NoMitgliedRoute>} />
              <Route path="fine-types" element={<NoMitgliedRoute><FineTypes /></NoMitgliedRoute>} />
              <Route path="fines" element={<DashboardRoute><Fines /></DashboardRoute>} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="statistics" element={<NoMitgliedRoute><Statistics /></NoMitgliedRoute>} />
              <Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
              <Route path="audit" element={<AdminRoute><AuditLogs /></AdminRoute>} />
              <Route path="settings" element={<AdminRoute><Settings /></AdminRoute>} />
            </Route>
            
            <Route path="*" element={<RoleBasedRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;