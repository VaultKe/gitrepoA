import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ConsolePage from './pages/ConsolePage';
import DownloadPage from './pages/DownloadPage';
import VersionCheckPage from './pages/VersionCheckPage';
import { getAuthToken, removeAuthToken } from './services/auth';
import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getAuthToken();
      setAuthenticated(!!token);
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) return <LoadingSpinner />;

  const location = useLocation();
  if (!authenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
}

export default function App() {
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const init = async () => {
      await getAuthToken();
      setInitializing(false);
    };
    init();
  }, []);

  if (initializing) return <LoadingSpinner />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/download" element={<Layout><DownloadPage /></Layout>} />
      <Route path="/version-check" element={<VersionCheckPage />} />
      <Route
        path="/console"
        element={
          <RequireAuth>
            <Layout>
              <ConsolePage />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to="/download" replace />} />
    </Routes>
  );
}
