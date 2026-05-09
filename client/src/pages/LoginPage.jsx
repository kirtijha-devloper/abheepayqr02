import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();
  const { info } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(null);

  const isAdminLogin = location.pathname.includes('/admin');

  const getRoleHome = (role) => {
    if (role === 'admin' || role === 'staff') return '/admin/dashboard';
    if (role === 'master') return '/master/dashboard';
    return '/dashboard';
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getRoleHome(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    const result = await login(email, password);

    if (result.success) {
      navigate(getRoleHome(result.role));
    } else {
      setError(result.message);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    info('Please contact your admin or support team to reset your password.');
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();
    info('Accounts are created by the admin team. Please ask your admin to onboard you.');
  };

  return (
    <div className="login-layout-v2">
      <div className="animated-bg-nodes">
        <div className="node node-1"></div>
        <div className="node node-2"></div>
        <div className="node node-3"></div>
      </div>
      
      <div className="login-container-v2 glass-panel">
        
        <div className="login-left-v2">
          <div className="login-brand-v2">
            <img className="brand-logo-art" src="/liopay-logo.jpg" alt="LIOPAY" />
          </div>

          <div className="login-hero-v2">
            <h1 className="hero-title">
              Powering <br />
              <span className="gradient-text">Next-Gen</span> Payments
            </h1>
            <p className="hero-desc">
              The premier toolkit for digital commerce. Secure, instant, and borderless transactions for your enterprise.
            </p>
          </div>

          <div className="login-perks">
            <div className="perk-item">
              <div className="perk-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="perk-text">Lightning Fast API</div>
            </div>
            <div className="perk-item">
              <div className="perk-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="perk-text">Bank-Grade Security</div>
            </div>
            <div className="perk-item">
              <div className="perk-icon">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="perk-text">Live Analytics</div>
            </div>
          </div>
        </div>

        <div className="login-right-v2">
          <div className="login-form-wrapper">
            <div className="form-header-v2">
              <h2>{isAdminLogin ? 'Admin Console' : 'Welcome Back'}</h2>
              <p>Authenticate to securely access your dashboard</p>
            </div>
            
            {error && (
              <div className="error-alert">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleLogin}>
              <div className={`input-group ${isFocused === 'email' ? 'focused' : ''}`}>
                <label htmlFor="email">Work Email</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  <input 
                    type="email" 
                    id="email" 
                    placeholder="name@company.com" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setIsFocused('email')}
                    onBlur={() => setIsFocused(null)}
                  />
                </div>
              </div>
              
              <div className={`input-group ${isFocused === 'password' ? 'focused' : ''}`}>
                <div className="label-row">
                  <label htmlFor="password">Password</label>
                  <a href="/" className="forgot-link" onClick={handleForgotPassword}>Forgot?</a>
                </div>
                <div className="input-wrapper">
                  <svg className="input-icon" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input 
                    type="password" 
                    id="password" 
                    placeholder="Password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setIsFocused('password')}
                    onBlur={() => setIsFocused(null)}
                  />
                </div>
              </div>
              
              <button type="submit" className="btn-glow-submit">
                <span>Access Dashboard</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </form>
            
            <p className="auth-footer">
              Don't have an account? <a href="/" onClick={handleCreateAccount}>Create one</a>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
