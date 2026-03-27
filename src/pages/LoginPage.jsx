import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const isAdminLogin = location.pathname.includes('/admin');

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    const result = await login(email, password);

    if (result.success) {
      if (result.role === 'admin') {
         navigate('/admin/dashboard');
      } else {
         navigate('/dashboard');
      }
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-logo-mark">T</div>
          <div className="login-brand-text">
            <span className="login-brand-name">TeleRing</span>
            <span className="login-brand-tagline">Payment Platform</span>
          </div>
        </div>

        <div className="login-hero">
          <h1>Modern <span>Banking</span> <br />for your business</h1>
          <p>The most powerful and flexible toolkit for internet commerce. Manage your payments with ease and security.</p>
        </div>

        <div className="login-features">
          <div className="login-feature-item">
            <div className="feature-icon">✓</div>
            <span className="feature-text">Real-time Transaction Monitoring</span>
          </div>
          <div className="login-feature-item">
            <div className="feature-icon">✓</div>
            <span className="feature-text">Seamless API Integration</span>
          </div>
          <div className="login-feature-item">
            <div className="feature-icon">✓</div>
            <span className="feature-text">Enterprise-grade Security</span>
          </div>
        </div>
      </div>
      
      <div className="login-right">
        <div className="login-form-container">
          <div className="login-form-header">
            <h2>{isAdminLogin ? 'Admin Portal' : 'Welcome Back'}</h2>
            <p>Enter your details to access your dashboard</p>
          </div>
          
          {error && <div className="login-error-msg">{error}</div>}

          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input 
                type="email" 
                id="email" 
                className="form-input" 
                placeholder="name@company.com" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input 
                type="password" 
                id="password" 
                className="form-input" 
                placeholder="••••••••" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            
            <button type="submit" className="login-submit-btn">
              Sign in
            </button>
          </form>
          
          <p className="login-footer-text">
            © 2026 TeleRing. All rights reserved. 
            <br />
            Need help? <a href="#">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
