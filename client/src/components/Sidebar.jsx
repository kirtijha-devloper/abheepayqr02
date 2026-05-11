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

  const handleScroll = (event) => {
    localStorage.setItem('sidebar-scroll', event.target.scrollTop);
  };

  const handleLogout = () => {
    logout();
    navigate(isAdmin ? '/admin/login' : '/login');
  };

  const merchantItems = [
    { name: 'Dashboard', icon: 'DB', path: '/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Transactions', icon: 'TX', path: '/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'Branches', icon: 'BR', path: '/branches', feature: 'branches', category: 'MAIN' },
    { name: 'QR Codes', icon: 'QR', path: '/merchant/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Settlements', icon: 'PO', path: '/settlements', feature: 'settlements', category: 'MAIN' },
    { name: 'Fund Requests', icon: 'FR', path: '/fund-requests', feature: 'fund_requests', category: 'MAIN' },
    { name: 'Reconciliation', icon: 'RC', path: '/reconciliation', feature: 'reconciliation', category: 'MANAGEMENT' },
    { name: 'Wallet', icon: 'WL', path: '/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Beneficiaries', icon: 'BN', path: '/beneficiaries', feature: 'wallet', category: 'MAIN' },
    { name: 'Ledger', icon: 'LD', path: '/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'Callbacks', icon: 'CB', path: '/callbacks', feature: 'callbacks', category: 'MANAGEMENT' },
    { name: 'Support', icon: 'SP', path: '/support', feature: 'support', category: 'HELP' },
    { name: 'Charges', icon: 'CH', path: '/charges', feature: 'charges', category: 'MANAGEMENT' },
    { name: 'Settings', icon: 'ST', path: '/settings', feature: 'settings', category: 'HELP' },
  ];

  const branchItems = [
    { name: 'Dashboard', icon: 'DB', path: '/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Transactions', icon: 'TX', path: '/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'QR Codes', icon: 'QR', path: '/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Wallet', icon: 'WL', path: '/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Beneficiaries', icon: 'BN', path: '/beneficiaries', feature: 'wallet', category: 'MAIN' },
    { name: 'Ledger', icon: 'LD', path: '/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'Support', icon: 'SP', path: '/support', feature: 'support', category: 'HELP' },
    { name: 'Settings', icon: 'ST', path: '/settings', feature: 'settings', category: 'HELP' },
  ];

  const adminItems = [
    { name: 'Dashboard', icon: 'DB', path: '/admin/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Staff Panel', icon: 'SF', path: '/admin/staff', category: 'MANAGEMENT' },
    { name: 'Transactions', icon: 'TX', path: '/admin/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'Super Distributors', icon: 'SD', path: '/admin/merchants', feature: 'masters', category: 'MAIN' },
    { name: 'User List', icon: 'US', path: '/admin/users', feature: 'users', category: 'MAIN' },
    { name: 'Wallet', icon: 'WL', path: '/admin/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Reconciliation', icon: 'RC', path: '/admin/reconciliation', feature: 'reconciliation', category: 'MANAGEMENT' },
    { name: 'QR Codes', icon: 'QR', path: '/admin/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Settlements', icon: 'PO', path: '/admin/settlements', feature: 'settlements', category: 'MAIN' },
    { name: 'Fund Requests', icon: 'FR', path: '/admin/fund-requests', feature: 'fund_requests', category: 'MAIN' },
    { name: 'Ledger', icon: 'LD', path: '/admin/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'Reports', icon: 'RP', path: '/admin/reports', feature: 'reports', category: 'MANAGEMENT' },
    { name: 'Callbacks', icon: 'CB', path: '/admin/callbacks', feature: 'callbacks', category: 'MANAGEMENT' },
    { name: 'Support', icon: 'SP', path: '/admin/support', feature: 'support', category: 'HELP' },
    { name: 'Charges', icon: 'CH', path: '/admin/charges', feature: 'charges', category: 'MANAGEMENT' },
    { name: 'Settings', icon: 'ST', path: '/admin/settings', feature: 'settings', category: 'HELP' },
  ];

  const masterItems = [
    { name: 'Dashboard', icon: 'DB', path: '/master/dashboard', feature: 'dashboard', category: 'MAIN' },
    { name: 'Transactions', icon: 'TX', path: '/master/transactions', feature: 'transactions', category: 'MAIN' },
    { name: 'Distributors', icon: 'DS', path: '/master/merchants', feature: 'merchants', category: 'MAIN' },
    { name: 'Wallet', icon: 'WL', path: '/master/wallet', feature: 'wallet', category: 'MAIN' },
    { name: 'Beneficiaries', icon: 'BN', path: '/master/beneficiaries', feature: 'wallet', category: 'MAIN' },
    { name: 'Ledger', icon: 'LD', path: '/master/ledger', feature: 'ledger', category: 'MANAGEMENT' },
    { name: 'QR Codes', icon: 'QR', path: '/master/qr-codes', feature: 'qr_codes', category: 'MANAGEMENT' },
    { name: 'Fund Requests', icon: 'FR', path: '/master/fund-requests', feature: 'fund_requests', category: 'MAIN' },
    { name: 'Settlements', icon: 'PO', path: '/master/settlements', feature: 'settlements', category: 'MAIN' },
    { name: 'Reconciliation', icon: 'RC', path: '/master/reconciliation', feature: 'reconciliation', category: 'MANAGEMENT' },
    { name: 'Reports', icon: 'RP', path: '/master/reports', feature: 'reports', category: 'MANAGEMENT' },
    { name: 'Callbacks', icon: 'CB', path: '/master/callbacks', feature: 'callbacks', category: 'MANAGEMENT' },
    { name: 'Support', icon: 'SP', path: '/master/support', feature: 'support', category: 'HELP' },
    { name: 'Charges', icon: 'CH', path: '/master/charges', feature: 'charges', category: 'MANAGEMENT' },
    { name: 'Settings', icon: 'ST', path: '/master/settings', feature: 'settings', category: 'HELP' },
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
    const category = item.category || 'MAIN';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
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
          {order.map((category) => {
            if (!groupedItems[category] || groupedItems[category].length === 0) return null;
            return (
              <div key={category} className="sidebar-group">
                <div className="sidebar-section-label">{category}</div>
                {groupedItems[category].map((item) => (
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
              {'->'}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
