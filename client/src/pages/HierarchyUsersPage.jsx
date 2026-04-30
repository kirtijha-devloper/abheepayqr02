import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import './HierarchyUsersPage.css';

const HierarchyUsersPage = () => {
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState('master'); 
    const { error } = useToast();

    const fetchAllUsers = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/users/all`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllUsers(data);
            }
        } catch (err) {
            error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllUsers();
    }, []);

    const filteredUsers = allUsers.filter(u => u.role === selectedRole);

    const roles = [
        { key: 'master', label: 'Masters', icon: '👑', desc: 'Top-level partners managing downlines.' },
        { key: 'merchant', label: 'Merchants', icon: '🏪', desc: 'Direct retailers and business owners.' },
        { key: 'branch', label: 'Branches', icon: '📍', desc: 'Sub-outlets under merchants.' }
    ];

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header title="Network Hierarchy" />
                <main className="dashboard-body animated">
                    <div className="hierarchy-container">
                        
                        <div className="role-cards-grid">
                            {roles.map(role => (
                                <div 
                                    key={role.key} 
                                    className={`role-card ${selectedRole === role.key ? 'active' : ''}`}
                                    onClick={() => setSelectedRole(role.key)}
                                >
                                    <div className="role-count">
                                        {allUsers.filter(u => u.role === role.key).length}
                                    </div>
                                    <div className="role-icon-circle">{role.icon}</div>
                                    <h3>{role.label}</h3>
                                    <p>{role.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="users-list-card animated-fade-in">
                            <div className="list-header">
                                <h2>{roles.find(r => r.key === selectedRole)?.label} Management</h2>
                                <div className="joining-date">Found {filteredUsers.length} members in network</div>
                            </div>

                            {loading ? (
                                <div style={{ padding: '80px', textAlign: 'center' }}>
                                    <div className="route-loader-spinner" style={{ margin: '0 auto 20px' }}></div>
                                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Synchronizing hierarchy data...</p>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div style={{ padding: '80px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.1 }}>👥</div>
                                    <p style={{ color: '#64748b', fontSize: '1.2rem' }}>No active {selectedRole}s found in your network.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="hierarchy-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '35%' }}>Member Details</th>
                                                <th style={{ width: '25%' }}>Contact & Status</th>
                                                <th style={{ width: '25%' }}>Upline Member</th>
                                                <th style={{ textAlign: 'right', width: '15%' }}>Joined Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(user => (
                                                <tr key={user.userId}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                            <div className="user-avatar-premium">
                                                                {(user.fullName || 'U').charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <span className="user-name-premium">{user.fullName || 'Unnamed'}</span>
                                                                <span className="user-email-premium">{user.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <span style={{ fontSize: '14px', color: '#fff', fontWeight: '500' }}>{user.phone || 'N/A'}</span>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <span className="role-badge" style={{ fontSize: '10px', background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                                                                    {user.status || 'Active'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="upline-badge">
                                                            {user.parentName || 'System Admin'}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <span className="joining-date">
                                                            {new Date(user.createdAt).toLocaleDateString('en-IN', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default HierarchyUsersPage;
