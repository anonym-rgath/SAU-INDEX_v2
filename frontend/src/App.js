import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BrandingProvider } from './contexts/BrandingContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Members = lazy(() => import('./pages/Members'));
const FineTypes = lazy(() => import('./pages/FineTypes'));
const Fines = lazy(() => import('./pages/Fines'));
const StatisticsAdvanced = lazy(() => import('./pages/StatisticsAdvanced'));
const Roles = lazy(() => import('./pages/Roles'));
const Profile = lazy(() => import('./pages/Profile'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const Settings = lazy(() => import('./pages/Settings'));
const ClubSettings = lazy(() => import('./pages/ClubSettings'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-stone-400 text-sm">Laden...</div>
  </div>
);

const RoleBasedRedirect = () => <Navigate to="/dashboard" replace />;

// Nur Admin + Spieß + Vorstand
const ManagementRoute = ({ children }) => {
  const { isMitglied } = useAuth();
  return isMitglied ? <Navigate to="/dashboard" replace /> : children;
};

// Nur Admin + Spieß + Vorstand (Erweiterte Statistiken)
const AdvancedStatsRoute = ({ children }) => {
  const { canSeeAdvancedStats } = useAuth();
  return canSeeAdvancedStats ? children : <Navigate to="/dashboard" replace />;
};

const AdminRoute = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <ThemeProvider>
    <BrandingProvider>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<RoleBasedRedirect />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="fines" element={<Fines />} />
              <Route path="statistics" element={<Navigate to="/statistics-advanced" replace />} />
              <Route path="statistics-advanced" element={<AdvancedStatsRoute><StatisticsAdvanced /></AdvancedStatsRoute>} />
              <Route path="members" element={<ManagementRoute><Members /></ManagementRoute>} />
              <Route path="roles" element={<ManagementRoute><Roles /></ManagementRoute>} />
              <Route path="profile" element={<Profile />} />
              <Route path="fine-types" element={<ManagementRoute><FineTypes /></ManagementRoute>} />
              <Route path="users" element={<Navigate to="/members" replace />} />
              <Route path="audit" element={<ManagementRoute><AuditLogs /></ManagementRoute>} />
              <Route path="club-settings" element={<ClubSettings />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<RoleBasedRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
    </BrandingProvider>
    </ThemeProvider>
  );
}

export default App;
