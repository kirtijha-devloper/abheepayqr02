import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { API_BASE } from '../config';
import { useToast } from '../context/ToastContext';
import './HierarchyUsersPage.css';

const HierarchyUsersPage = () => {
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRole, setSelectedRole] = useState('master'); // Default
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
                <Header title="Hierarchy User List" />
                <main className="dashboard-body animated">
                    <div className="hierarchy-container">
                        
                        <div className="role-cards-grid animated-fade-in">
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

                        <div className="users-list-card animated-scale-up">
                            <div className="list-header">
                                <h2>{roles.find(r => r.key === selectedRole)?.label} List</h2>
                                <div className="joining-date">Total: {filteredUsers.length} members</div>
                            </div>

                            {loading ? (
                                <div style={{ padding: '60px', textAlign: 'center' }}>
                                    <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 16px' }}></div>
                                    <p style={{ color: '#94a3b8' }}>Loading users...</p>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div style={{ padding: '60px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>👥</div>
                                    <p style={{ color: '#94a3b8' }}>No users found for this category.</p>
                                </div>
                            ) : (
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '35%' }}>Member Details</th>
                                                <th style={{ width: '25%' }}>Contact & Status</th>
                                                <th style={{ width: '25%' }}>Upline Member</th>
                                                <th style={{ textAlign: 'right', width: '15%' }}>Joined On</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsers.map(user => (
                                                <tr key={user.userId}>
                                                    <td>
                                                        <div className="user-cell">
                                                            <div className="user-avatar-small">
                                                                {(user.fullName || 'U').charAt(0)}
                                                            </div>
                                                            <div className="user-info-text">
                                                                <span className="user-name">{user.fullName || 'Unnamed'}</span>
                                                                <span className="user-email" style={{ fontSize: '11px' }}>{user.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                            <span style={{ fontSize: '13px', color: '#fff' }}>{user.phone || 'No Phone'}</span>
                                                            <span className="role-badge" style={{ alignSelf: 'flex-start', marginTop: '4px', fontSize: '10px' }}>{user.status || 'Active'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className="upline-badge">
                                                            {user.parentName || 'Direct'}
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
