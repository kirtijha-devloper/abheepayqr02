import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAdmin = location.pathname.startsWith('/admin');

  const handleLogout = () => {
    logout();
    navigate(isAdmin ? '/admin/login' : '/login');
  };

  const merchantItems = [
    { name: 'Dashboard', icon: '▦', path: '/dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/transactions' },
    { name: 'QR Codes', icon: '🔳', path: '/qr-codes' },
    { name: 'Wallet', icon: '💳', path: '/wallet' },
    { name: 'Callbacks', icon: '⚡', path: '/callbacks' },
    { name: 'Support', icon: '🎧', path: '/support' },
    { name: 'Settings', icon: '⚙️', path: '/settings' },
  ];

  const adminItems = [
    { name: 'Dashboard', icon: '▦', path: '/admin/dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/admin/transactions' },
    { name: 'Merchants', icon: '👥', path: '/admin/merchants' },
    { name: 'Wallet', icon: '💳', path: '/admin/wallet' },
    { name: 'Reconciliation', icon: '⚖️', path: '/admin/reconciliation' },
    { name: 'QR Codes', icon: '🔳', path: '/admin/qr-codes' },
    { name: 'Settlements', icon: '💸', path: '/admin/settlements' },
    { name: 'Callbacks', icon: '⚡', path: '/admin/callbacks' },
    { name: 'Support', icon: '🎧', path: '/admin/support' },
    { name: 'Settings', icon: '⚙️', path: '/admin/settings' },
  ];

  const menuItems = isAdmin ? adminItems : merchantItems;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">T</div>
        <div className="logo-wordmark">
          <span>TeleRing</span>
          <span>Payment Platform</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="nav-name">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
          <div className="user-details">
            <span className="user-name">{user?.name || 'User'}</span>
            <span className="user-role">{user?.role ? user.role.toUpperCase() : 'USER'}</span>
          </div>
          <button className="logout-btn" type="button" onClick={handleLogout} aria-label="Logout">↪</button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

