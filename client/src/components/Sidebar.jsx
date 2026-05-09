/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRoleLabel } from '../utils/roleLabels';
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
    { name: 'Dashboard', icon: '▦', path: '/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Transactions', icon: '⇄', path: '/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'Branches', icon: '👥', path: '/branches', feature: 'branches', category: 'MAIN' },
    { name: 'QR Codes', icon: '🔳', path: '/merchant/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Settlements', icon: '💸', path: '/settlements', feature: 'settlements', category: 'MAIN' },
    { name: 'Fund Requests', icon: '📥', path: '/fund-requests', feature: 'fund_requests', category: 'MAIN' },
    { name: 'Reconciliation', icon: '⚖', path: '/reconciliation', feature: 'reconciliation', category: 'MANAGEMENT' },
    { name: 'Wallet', icon: '💳', path: '/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Ledger', icon: '≡', path: '/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'Callbacks', icon: '⚡', path: '/callbacks', feature: 'callbacks', category: 'MANAGEMENT' },
    { name: 'Support', icon: '🎧', path: '/support', feature: 'support', category: 'HELP' },
    { name: 'Charges', icon: '％', path: '/charges', feature: 'charges', category: 'MANAGEMENT' },
    { name: 'Settings', icon: '⚙', path: '/settings', feature: 'settings', category: 'HELP' },
  ];

  const branchItems = [
    { name: 'Dashboard', icon: '▦', path: '/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Transactions', icon: '⇄', path: '/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'QR Codes', icon: '🔳', path: '/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Wallet', icon: '💳', path: '/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Ledger', icon: '≡', path: '/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'Support', icon: '🎧', path: '/support', feature: 'support', category: 'HELP' },
    { name: 'Settings', icon: '⚙', path: '/settings', feature: 'settings', category: 'HELP' },
  ];

  const adminItems = [
    { name: 'Dashboard', icon: '▦', path: '/admin/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Staff Panel', icon: '🛡', path: '/admin/staff', category: 'MANAGEMENT' },
    { name: 'Transactions', icon: '⇄', path: '/admin/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'Super Distributors', icon: '👥', path: '/admin/merchants', feature: 'masters', category: 'MAIN' },
    { name: 'User List', icon: '👥', path: '/admin/users', feature: 'users', category: 'MAIN' },
    { name: 'Wallet', icon: '💳', path: '/admin/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Reconciliation', icon: '⚖', path: '/admin/reconciliation', feature: 'reconciliation', category: 'MANAGEMENT' },
    { name: 'QR Codes', icon: '🔳', path: '/admin/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Settlements', icon: '💸', path: '/admin/settlements', feature: 'settlements', category: 'MAIN' },
    { name: 'Fund Requests', icon: '📥', path: '/admin/fund-requests', feature: 'fund_requests', category: 'MAIN' },
    { name: 'Ledger', icon: '≡', path: '/admin/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'Reports', icon: '📊', path: '/admin/reports', feature: 'reports', category: 'MANAGEMENT' },
    { name: 'Callbacks', icon: '⚡', path: '/admin/callbacks', feature: 'callbacks', category: 'MANAGEMENT' },
    { name: 'Support', icon: '🎧', path: '/admin/support', feature: 'support', category: 'HELP' },
    { name: 'Charges', icon: '％', path: '/admin/charges', feature: 'charges', category: 'MANAGEMENT' },
    { name: 'Settings', icon: '⚙', path: '/admin/settings', feature: 'settings', category: 'HELP' },
  ];

  const masterItems = [
    { name: 'Dashboard', icon: '▦', path: '/master/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Transactions', icon: '⇄', path: '/master/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'Distributors', icon: '👥', path: '/master/merchants', feature: 'merchants', category: 'MAIN' },
    { name: 'Wallet', icon: '💳', path: '/master/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Ledger', icon: '≡', path: '/master/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'QR Codes', icon: '🔳', path: '/master/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Fund Requests', icon: '📥', path: '/master/fund-requests', feature: 'fund_requests', category: 'MAIN' },
    { name: 'Settlements', icon: '💸', path: '/master/settlements', feature: 'settlements', category: 'MAIN' },
    { name: 'Reconciliation', icon: '⚖', path: '/master/reconciliation', feature: 'reconciliation', category: 'MANAGEMENT' },
    { name: 'Reports', icon: '📊', path: '/master/reports', feature: 'reports', category: 'MANAGEMENT' },
    { name: 'Callbacks', icon: '⚡', path: '/master/callbacks', feature: 'callbacks', category: 'MANAGEMENT' },
    { name: 'Support', icon: '🎧', path: '/master/support', feature: 'support', category: 'HELP' },
    { name: 'Charges', icon: '％', path: '/master/charges', feature: 'charges', category: 'MANAGEMENT' },
    { name: 'Settings', icon: '⚙', path: '/master/settings', feature: 'settings', category: 'HELP' },
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
      'Super Distributors': 'canManageUsers',
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
      'Super Distributors': 'masters',
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
    let items = [];
    if (isAdmin) {
      items = user?.role === 'staff' ? adminItems.filter((item) => canAccessAdminItem(item)) : adminItems;
    } else if (isMaster) {
      items = masterItems.filter((item) => hasFeatureEnabled(item.feature));
    } else if (user?.role === 'merchant') {
      items = merchantItems.filter((item) => hasFeatureEnabled(item.feature));
    } else if (user?.role === 'branch') {
      items = branchItems.filter((item) => hasFeatureEnabled(item.feature));
    } else {
      items = merchantItems.filter((item) => hasFeatureEnabled(item.feature));
    }
    return items;
  };

  const menuItems = getMenuItems();
  const groupedItems = menuItems.reduce((acc, item) => {
    const cat = item.category || 'MAIN';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const order = ['MAIN', 'MANAGEMENT', 'HELP'];

  return (
    <>
      <div
        className={`sidebar-backdrop ${isMobileOpen ? 'visible' : ''}`}
        onClick={() => setIsMobileOpen(false)}
      />
      <aside className={`sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          <img className="brand-logo-image" src="/liopay-logo.jpg" alt="LIOPAY" />
        </div>

        <nav className="sidebar-nav" ref={navRef} onScroll={handleScroll}>
          {order.map((cat) => {
            if (!groupedItems[cat] || groupedItems[cat].length === 0) return null;
            return (
              <div key={cat} className="sidebar-group">
                <div className="sidebar-section-label">{cat}</div>
                {groupedItems[cat].map((item) => (
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
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
            <div className="user-details">
              <span className="user-name">{user?.name || 'User'}</span>
              <span className="user-role">{formatRoleLabel(user?.role)}</span>
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
