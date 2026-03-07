import type { ReactElement } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { IntakePage } from './pages/IntakePage';
import { NewSearchPage } from './pages/NewSearchPage';
import { SessionPage } from './pages/SessionPage';
import { ReportPage } from './pages/ReportPage';
import { ProfilePage } from './pages/ProfilePage';

function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { accessToken, authBusy, authUser } = useAuth();

  if (!accessToken) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  if (authBusy) {
    return <div className="min-h-[50vh] flex items-center justify-center text-sm text-neutral-500">Restoring secure session...</div>;
  }

  if (!authUser) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/auth?next=${encodeURIComponent(next)}`} replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/new-search"
          element={
            <RequireAuth>
              <NewSearchPage />
            </RequireAuth>
          }
        />
        <Route
          path="/intake/:type"
          element={
            <RequireAuth>
              <IntakePage />
            </RequireAuth>
          }
        />
        <Route
          path="/session/:id"
          element={
            <RequireAuth>
              <SessionPage />
            </RequireAuth>
          }
        />
        <Route
          path="/report/:id"
          element={
            <RequireAuth>
              <ReportPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
