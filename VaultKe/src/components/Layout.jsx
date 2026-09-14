import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { removeAuthToken, getAuthToken, getStoredUserData } from '../services/auth';

const Header = () => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getAuthToken();
      setIsAuthenticated(!!token);
    };
    checkAuth();
  }, [location.pathname]);

  const handleLogout = async () => {
    await removeAuthToken();
    window.location.href = '/login';
  };

  const navItems = [{ path: '/download', label: 'Download' }];

  if (isAuthenticated) {
    navItems.push({ path: '/console', label: 'Play Console' });
  }

  return (
    <header className="border-bottom">
      <div className="container">
        <div className="flex-between" style={{ height: '64px' }}>
          <Link to="/" className="flex" style={{ gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '18px',
              color: 'var(--bg-primary)',
            }}>
              KV
            </div>
            <span className="font-bold text-xl">VaultKe Play Console</span>
          </Link>
          <nav className="flex" style={{ gap: '24px' }}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  color: location.pathname === item.path ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: location.pathname === item.path ? '600' : '400',
                  fontSize: '14px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: location.pathname === item.path
                    ? 'rgba(0, 209, 255, 0.1)'
                    : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                {item.label}
              </Link>
            ))}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="btn btn-outline btn-sm"
                style={{ marginLeft: '12px' }}
              >
                Logout
              </button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

const Footer = () => {
  return (
    <footer className="border-top" style={{ padding: '16px 0' }}>
      <div className="container">
        <div className="flex-between" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          <span>© {new Date().getFullYear()} VaultKe — APK Distribution</span>
          <span>Secure • Private • No code exposed</span>
        </div>
      </div>
    </footer>
  );
};

const Layout = ({ children }) => {
  return (
    <div className="app-container">
      <Header />
      <main className="page-wrapper">{children}</main>
      <Footer />
    </div>
  );
};

export default Layout;
