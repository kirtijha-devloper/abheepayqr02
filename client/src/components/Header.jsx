import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppContext } from '../context/AppContext';
import './Header.css';

const Header = ({ title }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { fetchData } = useAppContext();
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    const fetchNotifs = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch('http://localhost:4001/api/notifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setNotifications(data);
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000); // Polling every 10s
    return () => clearInterval(interval);
  }, []);

  const unreadNotifications = notifications.filter(n => !n.isRead);
  const unreadCount = unreadNotifications.length;

  const handleSettingsClick = () => {
    navigate(isAdmin ? '/admin/settings' : '/settings');
  };

  const markRead = async (id) => {
    try {
        const token = sessionStorage.getItem('authToken');
        await fetch(`http://localhost:4001/api/notifications/${id}/read`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
        return true;
    } catch (e) {}
    return false;
  };

  const clearNotifications = async (event) => {
    event.stopPropagation();
    try {
        const token = sessionStorage.getItem('authToken');
        await fetch('http://localhost:4001/api/notifications/read-all', {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications([]);
    } catch (err) {
        console.error("Failed to clear notifications", err);
    }
  };

  const displayName = user?.name || (isAdmin ? 'Admin' : 'User');
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const roleLabel = user?.role === 'admin' ? 'Super Admin' : (user?.role === 'merchant' ? 'Merchant' : 'User');

  return (
    <header className="main-header" aria-label={title || 'Header'}>
      <div className="header-left">
        <button className="menu-toggle" type="button" aria-label="Open menu">
          <span className="control-icon">☰</span>
        </button>
        <div className="header-search">
          <span className="header-search-icon">🔍</span>
          <input type="text" placeholder="Search transactions, merchants..." />
        </div>
      </div>

      <div className="header-right">
        <div style={{ position: 'relative' }}>
          <button 
            className="header-icon-btn" 
            type="button" 
            aria-label="Notifications" 
            onClick={() => setShowNotifMenu(!showNotifMenu)}
          >
            <span>🔔</span>
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>

          {showNotifMenu && (
            <div className="notif-dropdown card animated-scale-up" style={{
                position: 'absolute', top: '100%', right: 0, width: '320px', 
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '16px', marginTop: '12px', zIndex: 100,
                maxHeight: '400px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0 }}>Notifications</h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-mute)' }}>{notifications.length} recent</span>
                  <button 
                    style={{ 
                      fontSize: '11px', 
                      color: 'var(--accent)', 
                      background: 'transparent', 
                      border: 'none', 
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={clearNotifications}
                  >
                    Clear all
                  </button>
                </div>
              </div>
              {unreadNotifications.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-mute)' }}>No notifications</div>
              ) : (
                unreadNotifications.map(n => (
                  <div 
                    key={n.id} 
                    onClick={async (event) => {
                      event.stopPropagation();
                      const marked = await markRead(n.id);
                      const targetLink = n.link || n.redirect || n.path || n.route;
                      if (targetLink) {
                        navigate(targetLink);
                      }
                      if (marked) setShowNotifMenu(false);
                    }}
                    style={{ 
                      padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                      background: n.isRead ? 'transparent' : 'rgba(124,108,248,0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px', color: n.isRead ? 'var(--text-p)' : 'var(--text-h)' }}>{n.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-p)', opacity: 0.8 }}>{n.message}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-mute)', marginTop: '4px' }}>{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <button className="header-user-chip" type="button" onClick={handleSettingsClick}>
          <div className="header-avatar" aria-hidden="true">{avatarLetter}</div>
          <div className="header-user-info">
            <span className="header-user-name">{displayName}</span>
            <span className="header-user-role">{roleLabel}</span>
          </div>
          <span className="header-arrow" aria-hidden="true">▼</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
