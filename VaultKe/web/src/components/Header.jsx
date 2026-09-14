import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { removeAuthToken } from '../services/auth';

const Header = () => {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const token = await require('../services/auth').getAuthToken();
      setIsAuthenticated(!!token);
      if (token) {
        const stored = await require('../services/auth').getStoredUserData();
        if (stored?.email) setUserEmail(stored.email);
      }
    };
    checkAuth();
  }, [location.pathname]);

  const handleLogout = async () => {
    await removeAuthToken();
    window.location.href = '/login';
  };

  const navItems = [
    { path: '/download', label: 'Download' },
  ];

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
                  transition: 'all 0.2s ease',
                  backgroundColor: location.pathname === item.path
                    ? 'rgba(0, 209, 255, 0.1)'
                    : 'transparent',
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

export default Header;
