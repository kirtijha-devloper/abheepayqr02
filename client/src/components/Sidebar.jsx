import React, { useEffect, useState, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const MOBILE_BREAKPOINT = 940;

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const isMaster = location.pathname.startsWith('/master');
  const isAdmin = location.pathname.startsWith('/admin');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleToggle = () => {
      if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setIsMobileOpen((value) => !value);
      }
    };

    const handleResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        setIsMobileOpen(false);
      }
    };

    window.addEventListener('app:toggle-sidebar', handleToggle);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('app:toggle-sidebar', handleToggle);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', isMobileOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [isMobileOpen]);
  
  const navRef = useRef(null);

  // Restore scroll position
  useEffect(() => {
    const savedScroll = localStorage.getItem('sidebar-scroll');
    if (savedScroll && navRef.current) {
      navRef.current.scrollTop = parseInt(savedScroll, 10);
    }
  }, []);

  const handleScroll = (e) => {
    localStorage.setItem('sidebar-scroll', e.target.scrollTop);
  };

  const handleLogout = () => {
    logout();
    navigate(isAdmin ? '/admin/login' : '/login');
  };

  const merchantItems = [
    { name: 'Dashboard', icon: '▦', path: '/dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/transactions' },
    { name: 'Branches', icon: '👥', path: '/branches' },
    { name: 'QR Codes', icon: '🔳', path: '/qr-codes' },
    { name: 'Settlements', icon: '💸', path: '/settlements' },
    { name: 'Fund Requests', icon: '📥', path: '/fund-requests' },
    { name: 'Reconciliation', icon: '⚖', path: '/reconciliation' },
    { name: 'Wallet', icon: '💳', path: '/wallet' },
    { name: 'Callbacks', icon: '⚡', path: '/callbacks' },
    { name: 'Support', icon: '🎧', path: '/support' },
    { name: 'Charges', icon: '％', path: '/charges' },
    { name: 'Settings', icon: '⚙', path: '/settings' },
  ];

  const branchItems = [
    { name: 'Dashboard', icon: '▦', path: '/dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/transactions' },
    { name: 'QR Codes', icon: '🔳', path: '/qr-codes' },
    { name: 'Wallet', icon: '💳', path: '/wallet' },
    { name: 'Support', icon: '🎧', path: '/support' },
    { name: 'Settings', icon: '⚙', path: '/settings' },
  ];

  const adminItems = [
    { name: 'Dashboard', icon: '▦', path: '/admin/dashboard' },
    { name: 'Staff Panel', icon: '🛡️', path: '/admin/staff' },
    { name: 'Transactions', icon: '⇄', path: '/admin/transactions' },
    { name: 'Masters', icon: '👥', path: '/admin/merchants' },
    { name: 'User List', icon: '👥', path: '/admin/users' },
    { name: 'Wallet', icon: '💳', path: '/admin/wallet' },
    { name: 'Reconciliation', icon: '⚖', path: '/admin/reconciliation' },
    { name: 'QR Codes', icon: '🔳', path: '/admin/qr-codes' },
    { name: 'Settlements', icon: '💸', path: '/admin/settlements' },
    { name: 'Fund Requests', icon: '📥', path: '/admin/fund-requests' },
    { name: 'Reports', icon: '📊', path: '/admin/reports' },
    { name: 'Callbacks', icon: '⚡', path: '/admin/callbacks' },
    { name: 'Support', icon: '🎧', path: '/admin/support' },
    { name: 'Charges', icon: '％', path: '/admin/charges' },
    { name: 'Settings', icon: '⚙', path: '/admin/settings' },
  ];

  const masterItems = [
    { name: 'Dashboard', icon: '▦', path: '/master/dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/master/transactions' },
    { name: 'Merchants', icon: '👥', path: '/master/merchants' },
    { name: 'User List', icon: '👥', path: '/admin/users' },
    { name: 'Wallet', icon: '💳', path: '/master/wallet' },
    { name: 'QR Codes', icon: '🔳', path: '/master/qr-codes' },
    { name: 'Fund Requests', icon: '📥', path: '/master/fund-requests' },
    { name: 'Settlements', icon: '💸', path: '/master/settlements' },
    { name: 'Reconciliation', icon: '⚖', path: '/master/reconciliation' },
    { name: 'Reports', icon: '📊', path: '/master/reports' },
    { name: 'Callbacks', icon: '⚡', path: '/master/callbacks' },
    { name: 'Support', icon: '🎧', path: '/master/support' },
    { name: 'Charges', icon: '％', path: '/master/charges' },
    { name: 'Settings', icon: '⚙', path: '/master/settings' },
  ];

  const getMenuItems = () => {
    if (isAdmin) {
      if (user?.role === 'staff') {
        return adminItems.filter(item => item.name !== 'Staff Panel');
      }
      return adminItems;
    }
    if (isMaster) return masterItems;
    if (user?.role === 'merchant') return merchantItems;
    if (user?.role === 'branch') return branchItems;
    return merchantItems;
  };

  const menuItems = getMenuItems();

  return (
    <>
      <div
        className={`sidebar-backdrop ${isMobileOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-mark">T</div>
          <div className="logo-wordmark">
            <span>TeleRing</span>
            <span>Payment Platform</span>
          </div>
        </div>

        <nav className="sidebar-nav" ref={navRef} onScroll={handleScroll}>
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setIsMobileOpen(false)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
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
            <button className="logout-btn" type="button" onClick={handleLogout} aria-label="Logout">
              ↪
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
