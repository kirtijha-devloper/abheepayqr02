import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../config';
import './Header.css';

const Header = ({ title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const token = sessionStorage.getItem('authToken');
        const res = await fetch(`${API_BASE}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setShowNotifMenu(false);
  }, [location.pathname]);

  const unreadNotifications = notifications.filter((n) => !n.isRead);
  const unreadCount = unreadNotifications.length;

  const handleSettingsClick = () => {
    navigate(isAdmin ? '/admin/settings' : '/settings');
  };

  const toggleSidebar = () => {
    window.dispatchEvent(new CustomEvent('app:toggle-sidebar'));
  };

  const markRead = async (id) => {
    try {
      const token = sessionStorage.getItem('authToken');
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((current) =>
        current.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      return true;
    } catch (e) {
      return false;
    }
  };

  const clearNotifications = async (event) => {
    event.stopPropagation();
    try {
      const token = sessionStorage.getItem('authToken');
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications([]);
    } catch (err) {
      console.error('Failed to clear notifications', err);
    }
  };

  const displayName = user?.name || (isAdmin ? 'Admin' : 'User');
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const roleLabel =
    user?.role === 'admin' ? 'Super Admin' : 
    user?.role === 'staff' ? 'Staff' : 
    user?.role === 'merchant' ? 'Merchant' : 'User';

  return (
    <header className="main-header" aria-label={title || 'Header'}>
      <div className="header-left">
        <button className="menu-toggle" type="button" aria-label="Open menu" onClick={toggleSidebar}>
          <span className="control-icon">☰</span>
        </button>
        <div className="header-search">
          <span className="header-search-icon">🔍</span>
          <input type="text" placeholder="Search transactions, merchants..." />
        </div>
      </div>

      <div className="header-right">
        <div className="notif-wrapper">
          <button
            className="header-icon-btn"
            type="button"
            aria-label="Notifications"
            onClick={() => setShowNotifMenu((value) => !value)}
          >
            <span>🔔</span>
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>

          {showNotifMenu && (
            <div className="notif-dropdown card animated-scale-up">
              <div className="notif-dropdown-header">
                <h4>Notifications</h4>
                <div className="notif-dropdown-meta">
                  <span className="notif-dropdown-count">{notifications.length} recent</span>
                  <button className="notif-clear-btn" onClick={clearNotifications}>
                    Clear all
                  </button>
                </div>
              </div>
              {unreadNotifications.length === 0 ? (
                <div className="notif-empty">No notifications</div>
              ) : (
                unreadNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${n.isRead ? '' : 'unread'}`}
                    onClick={async (event) => {
                      event.stopPropagation();
                      const marked = await markRead(n.id);
                      const targetLink = n.link || n.redirect || n.path || n.route;
                      if (targetLink) navigate(targetLink);
                      if (marked) setShowNotifMenu(false);
                    }}
                  >
                    <div className={`notif-title ${n.isRead ? 'read' : ''}`}>{n.title}</div>
                    <div className="notif-message">{n.message}</div>
                    <div className="notif-time">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button className="header-user-chip" type="button" onClick={handleSettingsClick}>
          <div className="header-avatar" aria-hidden="true">
            {avatarLetter}
          </div>
          <div className="header-user-info">
            <span className="header-user-name">{displayName}</span>
            <span className="header-user-role">{roleLabel}</span>
          </div>
          <span className="header-arrow" aria-hidden="true">
            ▼
          </span>
        </button>
      </div>
    </header>
  );
};

export default Header;
