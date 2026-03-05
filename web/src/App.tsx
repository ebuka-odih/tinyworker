import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { IntakePage } from './pages/IntakePage';
import { SessionPage } from './pages/SessionPage';
import { ReportPage } from './pages/ReportPage';
import { ProfilePage } from './pages/ProfilePage';
import { Layout } from './components/Layout';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/new-search" element={<IntakePage />} />
          <Route path="/intake/:type" element={<IntakePage />} />
          <Route path="/session/:id" element={<SessionPage />} />
          <Route path="/report/:id" element={<ReportPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}
