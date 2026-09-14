import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { setAuthToken, setRefreshToken, storeUserData, getAuthToken } from '../services/auth';
import { showToast } from '../components/Toast';

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectToConsole, setRedirectToConsole] = useState(false);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    const check = async () => {
      const token = await getAuthToken();
      if (token) setRedirectToConsole(true);
    };
    check();
  }, []);

  if (redirectToConsole) {
    window.location.href = '/console';
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setApiError('');

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', { email, password });
        if (res.success || res.data?.token) {
          const token = res.data?.token || res.token;
          const refreshToken = res.data?.refreshToken;
          const user = res.data?.user || { email };
          await setAuthToken(token);
          if (refreshToken) await setRefreshToken(refreshToken);
          await storeUserData(user);
          showToast('Login successful! Redirecting to console...', 'success');
          window.location.href = '/console';
        }
      } else {
        const res = await api.post('/auth/register', {
          email,
          password,
          firstName,
          lastName,
          phone,
        });
        if (res.success) {
          showToast('Account created! Please log in.', 'success');
          setIsLogin(true);
          setEmail('');
          setPassword('');
        }
      }
    } catch (err) {
      const msg = err?.message || err?.error || 'Something went wrong';
      setApiError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="page-wrapper">
        <div className="flex-center" style={{ minHeight: '100vh' }}>
          <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
            <div className="flex-center" style={{ gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '48px', height: '48px',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                borderRadius: '12px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 'bold', fontSize: '22px',
                color: 'var(--bg-primary)',
              }}>KV</div>
              <div>
                <h1 className="text-xl font-bold">VaultKe Play Console</h1>
                <p className="text-sm text-muted">Secure APK Distribution</p>
              </div>
            </div>

            {apiError && (
              <div className="mb-3" style={{
                padding: '10px 14px',
                background: 'rgba(255, 68, 102, 0.1)',
                border: '1px solid var(--error)',
                borderRadius: '8px',
                color: 'var(--error)',
                fontSize: '13px',
              }}>
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {!isLogin && (
                <>
                  <div className="gap-3" style={{ marginBottom: '16px' }}>
                    <input
                      type="text" className="input" placeholder="First Name"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="gap-3" style={{ marginBottom: '16px' }}>
                    <input
                      type="text" className="input" placeholder="Last Name"
                      value={lastName} onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="gap-3" style={{ marginBottom: '16px' }}>
                    <input
                      type="tel" className="input" placeholder="Phone Number"
                      value={phone} onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div style={{ marginBottom: '16px' }}>
                <input
                  type="email" className="input" placeholder="Email Address"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <input
                  type="password" className="input" placeholder={isLogin ? 'Password' : 'Create Password'}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isLogin ? 1 : 6}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
              </button>
            </form>

            <div className="separator"></div>

            <div className="flex-center" style={{ gap: '6px', fontSize: '14px' }}>
              <span className="text-muted">
                {isLogin ? "Don't have an account?" : 'Already have an account?'}
              </span>
              <button
                onClick={() => { setIsLogin(!isLogin); setApiError(''); }}
                className="text-accent" style={{ fontWeight: '600' }}
              >
                {isLogin ? 'Sign Up' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
