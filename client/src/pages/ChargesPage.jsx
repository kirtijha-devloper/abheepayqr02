import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE } from '../config';
import './ChargesPage.css';
import './MerchantsPage.css';

const GLOBAL_ROLE_OPTIONS = ['master', 'merchant', 'branch'];
const SERVICE_OPTIONS = [
    { value: 'payout', label: 'Settlement (Payout)' },
    { value: 'branchx_payout', label: 'BranchX Payout Charge' },
    { value: 'collection', label: 'Fund Request (Collection)' },
];

const getImmediateDownlineRole = (role) => {
    if (role === 'master') return 'merchant';
    if (role === 'merchant') return 'branch';
    if (role === 'admin' || role === 'staff') return 'master';
    return null;
};

const ChargesPage = () => {
    const { user: currentUser } = useAuth();
    const { merchants } = useAppContext();
    const { success, error } = useToast();

    const [overrides, setOverrides] = useState([]);
    const [downlineDefaults, setDownlineDefaults] = useState([]);
    const [slabs, setSlabs] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('override');
    const [searchQuery, setSearchQuery] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [targetUser, setTargetUser] = useState(null);
    const [targetRole, setTargetRole] = useState('merchant');
    const [serviceKey, setServiceKey] = useState('payout');
    const [selectedBaseSlabId, setSelectedBaseSlabId] = useState('');
    const [chargeType, setChargeType] = useState('percent');
    const [chargeValue, setChargeValue] = useState('');
    const [minAmount, setMinAmount] = useState('0');
    const [maxAmount, setMaxAmount] = useState('999999');

    const isAdmin = currentUser?.role === 'admin';
    const canManageOverrides = isAdmin || ['master', 'merchant'].includes(currentUser?.role);
    const visibleUsers = currentUser?.role === 'admin' || currentUser?.role === 'staff'
        ? allUsers
        : Array.isArray(merchants) ? merchants : [];

    const parseErrorResponse = async (res, fallbackMessage) => {
        try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const data = await res.json();
                return data?.error || data?.message || fallbackMessage;
            }

            const text = (await res.text()).trim();
            return text || fallbackMessage;
        } catch {
            return fallbackMessage;
        }
    };

    const formatCharge = (type, value) => type === 'percent' ? `${value}%` : `Rs ${value}`;
    const formatRange = (min, max) => `Rs ${min} - Rs ${Number(max) >= 9999999 ? 'Infinity' : max}`;

    const fetchData = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const headers = { Authorization: `Bearer ${token}` };
            const canSearchAllUsers = currentUser?.role === 'admin' || currentUser?.role === 'staff';

            const requests = [
                fetch(`${API_BASE}/commission/overrides`, { headers }),
                fetch(`${API_BASE}/commission/slabs`, { headers }),
                fetch(`${API_BASE}/commission/downline-defaults`, { headers }),
            ];

            if (canSearchAllUsers) {
                requests.push(fetch(`${API_BASE}/users/all`, { headers }));
            }

            const [ovRes, slabRes, defaultsRes, usersRes] = await Promise.all(requests);

            if (ovRes.ok) {
                setOverrides(await ovRes.json());
            } else {
                console.error('Failed to fetch overrides:', await parseErrorResponse(ovRes, 'Unknown error'));
            }

            if (slabRes.ok) {
                setSlabs(await slabRes.json());
            } else {
                const slabError = await parseErrorResponse(slabRes, 'Failed to fetch slabs');
                console.error('Failed to fetch slabs:', slabError);
                error(`Slabs load failed: ${slabError}`);
            }

            if (defaultsRes.ok) {
                setDownlineDefaults(await defaultsRes.json());
            } else {
                console.error('Failed to fetch downline defaults:', await parseErrorResponse(defaultsRes, 'Unknown error'));
            }

            if (usersRes?.ok) {
                setAllUsers(await usersRes.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const findExistingDownlineDefault = (role, key, minAmountValue) =>
        downlineDefaults.find((item) =>
            item.owner_user_id === currentUser?.id &&
            item.target_role === role &&
            item.service_key === key &&
            Number(item.min_amount) === Number(minAmountValue)
        );

    const findExistingOverride = (userId, key, minAmountValue) =>
        overrides.find((item) =>
            item.target_user_id === userId &&
            item.service_key === key &&
            Number(item.min_amount) === Number(minAmountValue)
        );

    const suggestions = useMemo(() => visibleUsers.filter((userItem) =>
        (userItem.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            userItem.email?.toLowerCase().includes(searchQuery.toLowerCase())) &&
        userItem.role !== 'admin'
    ).slice(0, 5), [searchQuery, visibleUsers]);

    const downlineRole = useMemo(() => getImmediateDownlineRole(currentUser?.role), [currentUser?.role]);

    const currentRoleSlabs = useMemo(() =>
        currentUser?.role
            ? slabs.filter((slab) => slab.role === currentUser.role)
            : [],
        [currentUser?.role, slabs]
    );

    const currentDownlineSlabs = useMemo(() =>
        downlineRole
            ? slabs.filter((slab) => slab.role === downlineRole)
            : [],
        [downlineRole, slabs]
    );

    const availableBaseSlabs = useMemo(() => {
        if (modalMode === 'global') return [];
        const role = modalMode === 'override' ? targetUser?.role : targetRole;
        if (!role) return [];
        return slabs
            .filter((slab) => slab.role === role && slab.serviceKey === serviceKey)
            .sort((a, b) => Number(a.minAmount) - Number(b.minAmount));
    }, [modalMode, serviceKey, slabs, targetRole, targetUser]);

    const selectedBaseSlab = useMemo(() =>
        availableBaseSlabs.find((slab) => slab.id === selectedBaseSlabId) || null,
        [availableBaseSlabs, selectedBaseSlabId]
    );

    useEffect(() => {
        if (!showModal || modalMode === 'global') return;
        if (availableBaseSlabs.length === 0) {
            setSelectedBaseSlabId('');
            setChargeType('flat');
            setMinAmount('0');
            setMaxAmount('999999');
            return;
        }

        const slabToUse = selectedBaseSlab || availableBaseSlabs[0];
        setSelectedBaseSlabId(slabToUse.id);
        setChargeType(slabToUse.chargeType || 'flat');
        setMinAmount(String(slabToUse.minAmount));
        setMaxAmount(String(slabToUse.maxAmount));
    }, [availableBaseSlabs, modalMode, selectedBaseSlab, showModal]);

    useEffect(() => {
        if (!showModal || modalMode === 'global' || !selectedBaseSlab) return;

        if (modalMode === 'downline-default') {
            const existingDefault = findExistingDownlineDefault(targetRole, selectedBaseSlab.serviceKey, selectedBaseSlab.minAmount);
            setChargeValue(existingDefault ? String(existingDefault.charge_value) : '');
            return;
        }

        if (modalMode === 'override' && targetUser) {
            const targetUserId = targetUser.userId || targetUser.id;
            const existingOverride = findExistingOverride(targetUserId, selectedBaseSlab.serviceKey, selectedBaseSlab.minAmount);
            setChargeValue(existingOverride ? String(existingOverride.charge_value) : '');
        }
    }, [modalMode, selectedBaseSlab, showModal, targetRole, targetUser]);

    const resetModal = () => {
        setTargetUser(null);
        setTargetRole('merchant');
        setServiceKey('payout');
        setSelectedBaseSlabId('');
        setChargeType('percent');
        setChargeValue('');
        setMinAmount('0');
        setMaxAmount('999999');
    };

    const handleOpenGlobalSlab = () => {
        resetModal();
        setModalMode('global');
        setShowModal(true);
    };

    const handleOpenDownlineCharge = (baseSlab) => {
        resetModal();
        setModalMode('downline-default');
        setTargetRole(downlineRole || 'merchant');
        setServiceKey(baseSlab.serviceKey);
        setSelectedBaseSlabId(baseSlab.id);
        const existingDefault = findExistingDownlineDefault(downlineRole, baseSlab.serviceKey, baseSlab.minAmount);
        setChargeValue(existingDefault ? String(existingDefault.charge_value) : '');
        setShowModal(true);
    };

    const handleOpenOverride = (userItem) => {
        resetModal();
        setModalMode('override');
        setTargetUser(userItem);
        setShowModal(true);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const handleSaveSlab = async () => {
        if (Number(chargeValue) < 0) {
            return error('Charge value cannot be negative.');
        }

        if (modalMode === 'global' && (Number(minAmount) < 0 || Number(maxAmount) <= Number(minAmount))) {
            return error('Invalid range. Max must be greater than Min.');
        }

        if (modalMode !== 'global' && !selectedBaseSlab) {
            return error('Please select an admin slab first.');
        }

        const token = sessionStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        };

        try {
            if (modalMode === 'global') {
                const res = await fetch(`${API_BASE}/commission/slabs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        role: targetRole,
                        service_key: serviceKey,
                        min_amount: Number(minAmount),
                        max_amount: Number(maxAmount),
                        charge_type: chargeType,
                        charge_value: Number(chargeValue),
                    }),
                });

                if (!res.ok) {
                    return error(await parseErrorResponse(res, 'Failed to add global slab.'));
                }
                success('Global slab added.');
            } else if (modalMode === 'downline-default') {
                const res = await fetch(`${API_BASE}/commission/downline-defaults`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target_role: targetRole,
                        service_key: serviceKey,
                        service_label: `${serviceKey} inherited charge`,
                        min_amount: Number(selectedBaseSlab.minAmount),
                        max_amount: Number(selectedBaseSlab.maxAmount),
                        charge_type: selectedBaseSlab.chargeType,
                        charge_value: Number(chargeValue),
                        commission_type: 'percent',
                        commission_value: 0,
                    }),
                });

                if (!res.ok) {
                    return error(await parseErrorResponse(res, 'Failed to save downline default.'));
                }
                success('Charge saved on admin slab.');
            } else {
                const res = await fetch(`${API_BASE}/commission/overrides`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target_user_id: targetUser.userId || targetUser.id,
                        service_key: serviceKey,
                        service_label: `${serviceKey} override`,
                        min_amount: Number(selectedBaseSlab.minAmount),
                        max_amount: Number(selectedBaseSlab.maxAmount),
                        charge_type: selectedBaseSlab.chargeType,
                        charge_value: Number(chargeValue),
                        commission_type: 'percent',
                        commission_value: 0,
                    }),
                });

                if (!res.ok) {
                    return error(await parseErrorResponse(res, 'Failed to save override.'));
                }
                success('Override saved on admin slab.');
            }

            setShowModal(false);
            resetModal();
            fetchData();
        } catch (err) {
            console.error(err);
            error('Connection error. Please try again.');
        }
    };

    const handleDeleteSlab = async (id, type = 'override') => {
        if (!window.confirm('Delete this charge override?')) return;
        try {
            const token = sessionStorage.getItem('authToken');
            const endpoint = type === 'global' ? `slabs/${id}` : type === 'downline-default' ? `downline-defaults/${id}` : `overrides/${id}`;
            const res = await fetch(`${API_BASE}/commission/${endpoint}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                success('Entry removed.');
                fetchData();
            }
        } catch (err) {
            console.error(err);
            error('Delete failed');
        }
    };

    const handleUpdateDefault = async (slabId, value, type) => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/commission/slabs/${slabId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    charge_value: Number(value),
                    charge_type: type,
                }),
            });

            if (res.ok) {
                success('Updated.');
                fetchData();
            }
        } catch (err) {
            console.error(err);
            error('Update failed');
        }
    };

    const canManageOwnCharges = ['master', 'merchant'].includes(currentUser?.role);

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <div className="main-content">
                <Header title="Management & Charges" />
                <main className="dashboard-body animated">
                    <div className="charges-header">
                        <div className="charges-title">
                            <h2>Charge Configuration</h2>
                            <p>Admin fixes the slab range. All other users can only set or override the charge on that same admin slab.</p>
                        </div>

                        <div className="charges-search-container">
                            <div className="merchant-search-wrap">
                                <span className="merchant-search-icon">Search</span>
                                <input
                                    type="text"
                                    placeholder="Search any user to override..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setShowSuggestions(true);
                                    }}
                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                    style={{ width: '100%' }}
                                    disabled={!canManageOverrides}
                                />
                            </div>
                            {showSuggestions && searchQuery && canManageOverrides && (
                                <div className="search-suggestions">
                                    {suggestions.length === 0 ? (
                                        <div style={{ padding: '12px', color: '#64748b' }}>No users found.</div>
                                    ) : suggestions.map((userItem) => (
                                        <div key={userItem.userId || userItem.id} className="suggestion-item" onClick={() => handleOpenOverride(userItem)}>
                                            <div className="user-avatar-small" style={{ width: '32px', height: '32px' }}>
                                                {userItem.fullName?.charAt(0)}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', color: '#fff' }}>{userItem.fullName}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b' }}>{userItem.role} - {userItem.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {isAdmin && (
                        <>
                            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>Default Global Charges (By Role)</h3>
                                <button className="add-slab-btn" onClick={handleOpenGlobalSlab}>Add Default Slab</button>
                            </div>
                            <div className="charges-card animated-fade-in" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>User Role</th>
                                                <th>Service</th>
                                                <th>Range</th>
                                                <th>Charge Type</th>
                                                <th>Value</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {slabs.map((slab) => (
                                                <tr key={slab.id}>
                                                    <td><strong style={{ color: '#fff', textTransform: 'capitalize' }}>{slab.role.replace('_', ' ')}</strong></td>
                                                    <td>{slab.serviceKey.replace('_', ' ').toUpperCase()}</td>
                                                    <td><span style={{ color: '#94a3b8', fontSize: '12px' }}>{formatRange(slab.minAmount, slab.maxAmount)}</span></td>
                                                    <td>
                                                        <select
                                                            className="charge-input"
                                                            style={{ width: '130px', padding: '4px' }}
                                                            value={slab.chargeType}
                                                            onChange={(e) => handleUpdateDefault(slab.id, slab.chargeValue, e.target.value)}
                                                        >
                                                            <option value="percent">Percent (%)</option>
                                                            <option value="flat">Flat (INR)</option>
                                                        </select>
                                                    </td>
                                                    <td>
                                                        <input
                                                            className="charge-input"
                                                            style={{ width: '90px', padding: '4px' }}
                                                            type="number"
                                                            value={slab.chargeValue}
                                                            onChange={(e) => handleUpdateDefault(slab.id, e.target.value, slab.chargeType)}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="delete-btn-v2" onClick={() => handleDeleteSlab(slab.id, 'global')}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {canManageOwnCharges && (
                        <>
                            <div className="section-header">
                                <h3>My Charges From Admin</h3>
                            </div>
                            <div className="charges-card animated-fade-in" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>Role</th>
                                                <th>Service</th>
                                                <th>Range</th>
                                                <th>Admin Charge</th>
                                                <th>Manual Override</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentRoleSlabs.length === 0 ? (
                                                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Admin has not created slabs for your role yet.</td></tr>
                                            ) : currentRoleSlabs.map((slab) => {
                                                const selfOverride = findExistingOverride(currentUser?.id, slab.serviceKey, slab.minAmount);
                                                return (
                                                    <tr key={slab.id}>
                                                        <td><strong style={{ color: '#fff', textTransform: 'capitalize' }}>{slab.role.replace('_', ' ')}</strong></td>
                                                        <td>{slab.serviceKey.replace('_', ' ').toUpperCase()}</td>
                                                        <td><span style={{ color: '#94a3b8', fontSize: '12px' }}>{formatRange(slab.minAmount, slab.maxAmount)}</span></td>
                                                        <td>{formatCharge(slab.chargeType, slab.chargeValue)}</td>
                                                        <td>{selfOverride ? formatCharge(selfOverride.charge_type, selfOverride.charge_value) : <span style={{ color: '#64748b' }}>None</span>}</td>
                                                        <td><span className={`status-pill ${selfOverride ? 'active' : 'info'}`}>{selfOverride ? 'OVERRIDDEN' : 'INHERITED'}</span></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {canManageOwnCharges && downlineRole && (
                        <>
                            <div className="section-header">
                                <h3>Charges For My {downlineRole === 'branch' ? 'Branches' : 'Merchants'}</h3>
                            </div>
                            <div className="charges-card animated-fade-in" style={{ background: 'rgba(34, 197, 94, 0.05)' }}>
                                <div className="table-responsive">
                                    <table className="charges-table">
                                        <thead>
                                            <tr>
                                                <th>Role</th>
                                                <th>Service</th>
                                                <th>Range</th>
                                                <th>Inherited Charge</th>
                                                <th>Your Charge</th>
                                                <th>Status</th>
                                                <th style={{ textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {currentDownlineSlabs.length === 0 ? (
                                                <tr><td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Admin has not created slabs for {downlineRole} yet.</td></tr>
                                            ) : currentDownlineSlabs.map((slab) => {
                                                const existingDefault = findExistingDownlineDefault(downlineRole, slab.serviceKey, slab.minAmount);
                                                return (
                                                    <tr key={slab.id}>
                                                        <td><strong style={{ color: '#fff', textTransform: 'capitalize' }}>{slab.role.replace('_', ' ')}</strong></td>
                                                        <td>{slab.serviceKey.replace('_', ' ').toUpperCase()}</td>
                                                        <td><span style={{ color: '#94a3b8', fontSize: '12px' }}>{formatRange(slab.minAmount, slab.maxAmount)}</span></td>
                                                        <td>{formatCharge(slab.chargeType, slab.chargeValue)}<div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>By admin</div></td>
                                                        <td>{existingDefault ? formatCharge(existingDefault.charge_type, existingDefault.charge_value) : <span style={{ color: '#64748b' }}>Not set</span>}</td>
                                                        <td><span className={`status-pill ${existingDefault ? 'active' : 'info'}`}>{existingDefault ? 'ACTIVE' : 'INHERITED'}</span></td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button className="add-btn-v2" onClick={() => handleOpenDownlineCharge(slab)}>
                                                                {existingDefault ? 'Edit Charge' : 'Set Charge'}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="section-header">
                        <h3>Manual Overrides (User Specific)</h3>
                    </div>

                    <div className="charges-card animated-fade-in">
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center' }}>
                                <div className="route-loader-spinner" style={{ margin: '0 auto 20px' }}></div>
                                <p style={{ color: '#94a3b8' }}>Loading overrides...</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="charges-table">
                                    <thead>
                                        <tr>
                                            <th>Member Identity</th>
                                            <th>Role</th>
                                            <th>Current Slab Overrides</th>
                                            <th style={{ textAlign: 'right' }}>Management</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!canManageOverrides ? (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Only admin, master, and merchant can manage manual charge overrides.</td></tr>
                                        ) : visibleUsers.length === 0 ? (
                                            <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>No users available.</td></tr>
                                        ) : visibleUsers.filter((userItem) => userItem.role !== 'admin').map((userItem) => {
                                            const userSlabs = overrides.filter((item) => item.target_user_id === (userItem.userId || userItem.id));
                                            return (
                                                <tr key={userItem.userId || userItem.id}>
                                                    <td>
                                                        <div className="user-cell">
                                                            <div className="user-avatar-small">{(userItem.fullName || 'U').charAt(0).toUpperCase()}</div>
                                                            <div className="user-info-text">
                                                                <span className="user-name">{userItem.fullName || 'Unnamed'}</span>
                                                                <span className="user-email">{userItem.email}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td><span className="role-tag">{userItem.role}</span></td>
                                                    <td>
                                                        <div className="slabs-list">
                                                            {userSlabs.length === 0 ? (
                                                                <span style={{ color: '#64748b', fontSize: '12px' }}>Using inherited slab charges.</span>
                                                            ) : userSlabs.map((slab) => (
                                                                <div key={slab.id} className="slab-badge">
                                                                    <span style={{ color: '#fff', opacity: 0.5 }}>{slab.service_key?.toUpperCase()}:</span>
                                                                    <span>{formatRange(slab.min_amount, slab.max_amount)}</span>
                                                                    <strong>{formatCharge(slab.charge_type, slab.charge_value)}</strong>
                                                                    <button className="remove-slab" onClick={() => handleDeleteSlab(slab.id)}>&times;</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <button className="add-btn-v2" onClick={() => handleOpenOverride(userItem)}>Set Override</button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-container" style={{ maxWidth: '560px' }}>
                        <div className="modal-header-gradient">
                            <h3>{modalMode === 'global' ? 'Add Global Default Slab' : modalMode === 'downline-default' ? 'Set Charge On Admin Slab' : 'Override Charge On Admin Slab'}</h3>
                            <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body hide-scrollbar">
                            {modalMode === 'override' && (
                                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>Target User</div>
                                    <div style={{ color: '#fff', fontWeight: 600 }}>{targetUser?.fullName}</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{targetUser?.email}</div>
                                </div>
                            )}

                            {modalMode === 'downline-default' && (
                                <div style={{ marginBottom: '20px', padding: '12px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.15)' }}>
                                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>Target Role</div>
                                    <div style={{ color: '#fff', fontWeight: 600, textTransform: 'capitalize' }}>{targetRole}</div>
                                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>This charge will be inherited by your {targetRole === 'branch' ? 'branches' : 'merchants'} on the selected admin slab.</div>
                                </div>
                            )}

                            <div className="modal-grid">
                                {modalMode === 'global' && (
                                    <div className="form-group full-width">
                                        <label className="callback-label">Target Role</label>
                                        <select className="form-input-box" value={targetRole} onChange={(e) => setTargetRole(e.target.value)}>
                                            {GLOBAL_ROLE_OPTIONS.map((roleOption) => (
                                                <option key={roleOption} value={roleOption}>{roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="form-group full-width">
                                    <label className="callback-label">Service Type</label>
                                    <select className="form-input-box" value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
                                        {SERVICE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {modalMode !== 'global' && (
                                    <div className="form-group full-width">
                                        <label className="callback-label">Admin Slab</label>
                                        <select className="form-input-box" value={selectedBaseSlabId} onChange={(e) => setSelectedBaseSlabId(e.target.value)} disabled={availableBaseSlabs.length === 0}>
                                            {availableBaseSlabs.length === 0 ? (
                                                <option value="">No admin slab available</option>
                                            ) : availableBaseSlabs.map((slab) => (
                                                <option key={slab.id} value={slab.id}>
                                                    {slab.serviceKey.toUpperCase()} | {formatRange(slab.minAmount, slab.maxAmount)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="callback-label">Minimum Amount (Rs)</label>
                                    <input type="number" className="form-input-box" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} readOnly={modalMode !== 'global'} />
                                </div>
                                <div className="form-group">
                                    <label className="callback-label">Maximum Amount (Rs)</label>
                                    <input type="number" className="form-input-box" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} readOnly={modalMode !== 'global'} />
                                </div>
                                <div className="form-group full-width">
                                    <label className="callback-label">{modalMode === 'global' ? 'Charge Mechanism' : 'Charge Mechanism (Inherited)'}</label>
                                    {modalMode === 'global' ? (
                                        <select className="form-input-box" value={chargeType} onChange={(e) => setChargeType(e.target.value)}>
                                            <option value="percent">Percentage (%)</option>
                                            <option value="flat">Flat (Rs)</option>
                                        </select>
                                    ) : (
                                        <input className="form-input-box" value={chargeType === 'percent' ? 'Percentage (%)' : 'Flat (Rs)'} readOnly />
                                    )}
                                </div>
                                {modalMode !== 'global' && (
                                    <div className="form-group full-width">
                                        <label className="callback-label">Inherited Charge</label>
                                        <input className="form-input-box" value={selectedBaseSlab ? formatCharge(selectedBaseSlab.chargeType, selectedBaseSlab.chargeValue) : 'No slab selected'} readOnly />
                                    </div>
                                )}
                                <div className="form-group full-width">
                                    <label className="callback-label">{modalMode === 'global' ? 'Charge Value' : 'Your Charge Value'}</label>
                                    <input type="number" className="form-input-box" value={chargeValue} onChange={(e) => setChargeValue(e.target.value)} placeholder="0.00" />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowModal(false)}>Close</button>
                            <button className="btn-create" onClick={handleSaveSlab}>
                                {modalMode === 'global' ? 'Create Slab' : modalMode === 'downline-default' ? 'Save Charge' : 'Apply Override'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChargesPage;
