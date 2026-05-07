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
  const navRef = useRef(null);

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
    { name: 'Dashboard', icon: '▦', path: '/dashboard', feature: 'dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/transactions', feature: 'transactions' },
    { name: 'Branches', icon: '👥', path: '/branches', feature: 'branches' },
    { name: 'QR Codes', icon: '🔳', path: '/merchant/qr-codes', feature: 'qr_codes' },
    { name: 'Settlements', icon: '💸', path: '/settlements', feature: 'settlements' },
    { name: 'Fund Requests', icon: '📥', path: '/fund-requests', feature: 'fund_requests' },
    { name: 'Reconciliation', icon: '⚖', path: '/reconciliation', feature: 'reconciliation' },
    { name: 'Wallet', icon: '💳', path: '/wallet', feature: 'wallet' },
    { name: 'Ledger', icon: '≡', path: '/ledger', feature: 'ledger' },
    { name: 'Callbacks', icon: '⚡', path: '/callbacks', feature: 'callbacks' },
    { name: 'Support', icon: '🎧', path: '/support', feature: 'support' },
    { name: 'Charges', icon: '％', path: '/charges', feature: 'charges' },
    { name: 'Settings', icon: '⚙', path: '/settings', feature: 'settings' },
  ];

  const branchItems = [
    { name: 'Dashboard', icon: '▦', path: '/dashboard', feature: 'dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/transactions', feature: 'transactions' },
    { name: 'QR Codes', icon: '🔳', path: '/qr-codes', feature: 'qr_codes' },
    { name: 'Wallet', icon: '💳', path: '/wallet', feature: 'wallet' },
    { name: 'Ledger', icon: '≡', path: '/ledger', feature: 'ledger' },
    { name: 'Support', icon: '🎧', path: '/support', feature: 'support' },
    { name: 'Settings', icon: '⚙', path: '/settings', feature: 'settings' },
  ];

  const adminItems = [
    { name: 'Dashboard', icon: '▦', path: '/admin/dashboard', feature: 'dashboard' },
    { name: 'Staff Panel', icon: '🛡️', path: '/admin/staff' },
    { name: 'Transactions', icon: '⇄', path: '/admin/transactions', feature: 'transactions' },
    { name: 'Masters', icon: '👥', path: '/admin/merchants', feature: 'masters' },
    { name: 'User List', icon: '👥', path: '/admin/users', feature: 'users' },
    { name: 'Wallet', icon: '💳', path: '/admin/wallet', feature: 'wallet' },
    { name: 'Reconciliation', icon: '⚖', path: '/admin/reconciliation', feature: 'reconciliation' },
    { name: 'QR Codes', icon: '🔳', path: '/admin/qr-codes', feature: 'qr_codes' },
    { name: 'Settlements', icon: '💸', path: '/admin/settlements', feature: 'settlements' },
    { name: 'Fund Requests', icon: '📥', path: '/admin/fund-requests', feature: 'fund_requests' },
    { name: 'Ledger', icon: '≡', path: '/admin/ledger', feature: 'ledger' },
    { name: 'Reports', icon: '📊', path: '/admin/reports', feature: 'reports' },
    { name: 'Callbacks', icon: '⚡', path: '/admin/callbacks', feature: 'callbacks' },
    { name: 'Support', icon: '🎧', path: '/admin/support', feature: 'support' },
    { name: 'Charges', icon: '％', path: '/admin/charges', feature: 'charges' },
    { name: 'Settings', icon: '⚙', path: '/admin/settings', feature: 'settings' },
  ];

  const masterItems = [
    { name: 'Dashboard', icon: '▦', path: '/master/dashboard', feature: 'dashboard' },
    { name: 'Transactions', icon: '⇄', path: '/master/transactions', feature: 'transactions' },
    { name: 'Merchants', icon: '👥', path: '/master/merchants', feature: 'merchants' },
    { name: 'Wallet', icon: '💳', path: '/master/wallet', feature: 'wallet' },
    { name: 'Ledger', icon: '≡', path: '/master/ledger', feature: 'ledger' },
    { name: 'QR Codes', icon: '🔳', path: '/master/qr-codes', feature: 'qr_codes' },
    { name: 'Fund Requests', icon: '📥', path: '/master/fund-requests', feature: 'fund_requests' },
    { name: 'Settlements', icon: '💸', path: '/master/settlements', feature: 'settlements' },
    { name: 'Reconciliation', icon: '⚖', path: '/master/reconciliation', feature: 'reconciliation' },
    { name: 'Reports', icon: '📊', path: '/master/reports', feature: 'reports' },
    { name: 'Callbacks', icon: '⚡', path: '/master/callbacks', feature: 'callbacks' },
    { name: 'Support', icon: '🎧', path: '/master/support', feature: 'support' },
    { name: 'Charges', icon: '％', path: '/master/charges', feature: 'charges' },
    { name: 'Settings', icon: '⚙', path: '/master/settings', feature: 'settings' },
  ];

  const hasFeatureEnabled = (feature) => {
    if (!feature || user?.role === 'admin') return true;
    return Array.isArray(user?.enabledFeatures) ? user.enabledFeatures.includes(feature) : true;
  };

  const canAccessAdminItem = (item) => {
    if (user?.role === 'admin') return true;
    if (user?.role !== 'staff') return true;

    const permissionMap = {
      'Staff Panel': 'canManageSecurity',
      Transactions: 'canViewReports',
      Masters: 'canManageUsers',
      'User List': 'canManageUsers',
      Wallet: 'canManageFinances',
      Reconciliation: 'canManageFinances',
      'QR Codes': 'canManageServices',
      Settlements: 'canManageFinances',
      'Fund Requests': 'canManageFinances',
      Ledger: 'canViewReports',
      Reports: 'canViewReports',
      Callbacks: 'canManageServices',
      Support: 'canViewReports',
      Charges: 'canManageCommissions',
      Settings: 'canManageSettings',
    };
    const pageMap = {
      Dashboard: 'dashboard',
      Transactions: 'transactions',
      Masters: 'masters',
      'User List': 'users',
      Wallet: 'wallet',
      Reconciliation: 'reconciliation',
      'QR Codes': 'qr_codes',
      Settlements: 'settlements',
      'Fund Requests': 'fund_requests',
      Ledger: 'ledger',
      Reports: 'reports',
      Callbacks: 'callbacks',
      Support: 'support',
      Charges: 'charges',
      Settings: 'settings',
    };

    const requiredPermission = permissionMap[item.name];
    const requiredPage = pageMap[item.name];
    const hasPermission = !requiredPermission || !!user?.permissions?.[requiredPermission];
    const hasPageAccess = !requiredPage || !!user?.allowedPages?.includes(requiredPage);
    return hasPermission && hasPageAccess && hasFeatureEnabled(item.feature);
  };

  const getMenuItems = () => {
    if (isAdmin) {
      if (user?.role === 'staff') {
        return adminItems.filter((item) => canAccessAdminItem(item));
      }
      return adminItems;
    }
    if (isMaster) return masterItems.filter((item) => hasFeatureEnabled(item.feature));
    if (user?.role === 'merchant') return merchantItems.filter((item) => hasFeatureEnabled(item.feature));
    if (user?.role === 'branch') return branchItems.filter((item) => hasFeatureEnabled(item.feature));
    return merchantItems.filter((item) => hasFeatureEnabled(item.feature));
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
          <div className="logo-wordmark">
            <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.02em' }}>LeoPay</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-mute)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Platform</span>
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
