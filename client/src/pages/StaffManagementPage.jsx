import React, { useEffect, useState, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useAppContext } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import './StaffManagementPage.css';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  pageAccess: [],
  permissions: {
    canManageUsers: false,
    canManageFinances: false,
    canManageCommissions: false,
    canManageServices: false,
    canManageSettings: false,
    canManageSecurity: false,
    canViewReports: false,
  }
};

const permissionOptions = [
  { key: 'canManageUsers', title: 'Manage Users', desc: 'Create and edit merchant, master, and branch accounts.' },
  { key: 'canManageFinances', title: 'Manage Finances', desc: 'Approve fund requests, settlements, and wallet actions.' },
  { key: 'canManageCommissions', title: 'Manage Charges', desc: 'Update slabs, rates, and commission settings.' },
  { key: 'canManageServices', title: 'Manage Services', desc: 'Control QR, callbacks, and operational service tools.' },
  { key: 'canViewReports', title: 'View Reports', desc: 'Access reports, ledger, transactions, and support views.' },
  { key: 'canManageSettings', title: 'Manage Settings', desc: 'Change platform and account setting screens.' },
  { key: 'canManageSecurity', title: 'Manage Security', desc: 'Control security-sensitive administrative operations.' },
];

const pageOptions = [
  { key: 'dashboard', title: 'Dashboard' },
  { key: 'transactions', title: 'Transactions' },
  { key: 'masters', title: 'Masters' },
  { key: 'users', title: 'User List' },
  { key: 'wallet', title: 'Wallet' },
  { key: 'reconciliation', title: 'Reconciliation' },
  { key: 'qr_codes', title: 'QR Codes' },
  { key: 'settlements', title: 'Settlements' },
  { key: 'fund_requests', title: 'Fund Requests' },
  { key: 'ledger', title: 'Ledger' },
  { key: 'reports', title: 'Reports' },
  { key: 'callbacks', title: 'Callbacks' },
  { key: 'support', title: 'Support' },
  { key: 'charges', title: 'Charges' },
  { key: 'settings', title: 'Settings' },
];

const StaffManagementPage = () => {
  const [showModal, setShowModal] = useState(false);
  const { staffMembers, addStaffMember, updateStaffMember, deleteStaffMember, fetchStaffMembers, loginAs } = useAppContext();
  const { success, error } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchStaffMembers();
  }, [fetchStaffMembers]);

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    if (name.startsWith('perm_')) {
      const permKey = name.replace('perm_', '');
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          [permKey]: checked
        }
      });
    } else if (name.startsWith('page_')) {
      const pageKey = name.replace('page_', '');
      setFormData((prev) => ({
        ...prev,
        pageAccess: checked
          ? Array.from(new Set([...(prev.pageAccess || []), pageKey]))
          : (prev.pageAccess || []).filter((page) => page !== pageKey),
      }));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setSelectedStaff(null);
    setFormData(emptyForm);
  };

  const setAllPermissions = (enabled) => {
    const nextPermissions = Object.fromEntries(
      permissionOptions.map((perm) => [perm.key, enabled])
    );
    setFormData((prev) => ({
      ...prev,
      permissions: nextPermissions
    }));
  };

  const setAllPages = (enabled) => {
    setFormData((prev) => ({
      ...prev,
      pageAccess: enabled ? pageOptions.map((page) => page.key) : []
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEditing && selectedStaff) {
      const res = await updateStaffMember(selectedStaff.id, {
        fullName: formData.fullName,
        phone: formData.phone,
        permissions: formData.permissions,
        pageAccess: formData.pageAccess
      });

      if (res.success) {
        success('Staff member updated successfully.');
        closeModal();
      } else {
        error(res.error || 'Failed to update staff member');
      }
      return;
    }

    const res = await addStaffMember(formData);

    if (res.success) {
      success('Staff member created successfully.');
      closeModal();
    } else {
      error(res.error || 'Failed to create staff member');
    }
  };

  const handleEdit = (staff) => {
    setSelectedStaff(staff);
    setIsEditing(true);
    setFormData({
      fullName: staff.fullName || '',
      email: staff.email || '',
      phone: staff.phone || '',
      password: '',
      pageAccess: Array.isArray(staff.pageAccess) ? staff.pageAccess : [],
      permissions: {
        ...emptyForm.permissions,
        ...(staff.permissions || {})
      }
    });
    setShowModal(true);
  };

  const filteredStaff = useMemo(() => staffMembers.filter((staff) => {
    const term = searchTerm.toLowerCase();
    return !searchTerm || 
      staff.fullName?.toLowerCase().includes(term) || 
      staff.email?.toLowerCase().includes(term) ||
      staff.phone?.includes(term);
  }), [staffMembers, searchTerm]);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <Header />
        <main className="dashboard-body animated">
          <div className="staff-header">
            <div className="staff-title">
              <h2>Staff Administration</h2>
              <p>Manage administrative staff and their operational access levels.</p>
            </div>
            <button className="add-staff-btn" onClick={() => setShowModal(true)}>
              <span>+</span> New Staff Member
            </button>
          </div>

          <div className="staff-table-card">
            <div className="staff-toolbar">
              <div className="staff-search-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', flex: '1 1 360px' }}>
                <label className="staff-search-label" htmlFor="staff-search" style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-mute)' }}>
                  Search Staff
                </label>
                <div className="staff-search-wrap">
                  <span className="staff-search-icon" style={{ fontSize: '1rem', left: '1rem', textTransform: 'none', color: '#94a3b8' }}>🔎</span>
                  <input
                    id="staff-search"
                    type="text"
                    placeholder="Name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <span className="staff-search-meta" style={{ fontSize: '0.78rem', color: 'var(--text-mute)' }}>
                  {filteredStaff.length} result{filteredStaff.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="staff-table">
                <thead>
                   <tr>
                    <th>ID</th>
                    <th>Staff Member</th>
                    <th>Status</th>
                    <th>Permissions / Pages</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                   {filteredStaff.map((staff, index) => (
                    <tr key={staff.id}>
                      <td><span className="mid-badge">LEO{String(index + 1).padStart(3, '0')}</span></td>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar">{staff.fullName?.charAt(0).toUpperCase() || 'S'}</div>
                          <div className="staff-name-info">
                            <div className="s-name">{staff.fullName}</div>
                            <div className="s-email">{staff.email}</div>
                            {staff.phone && <div className="s-email" style={{opacity: 0.8}}>{staff.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span 
                          className={`status-pill ${staff.status === 'blocked' ? 'inactive' : 'active'}`}
                          onClick={async () => {
                            const newStatus = staff.status === 'blocked' ? 'active' : 'blocked';
                            const res = await updateStaffMember(staff.id, { status: newStatus });
                            if (res.success) success(`Staff member ${newStatus === 'active' ? 'activated' : 'blocked'}.`);
                            else error(res.error || 'Update failed');
                          }}
                          style={{cursor: 'pointer'}}
                        >
                          {staff.status === 'blocked' ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <div className="permissions-summary">
                          {staff.permissions && Object.entries(staff.permissions)
                            .filter(([key, val]) => val === true && key.startsWith('can'))
                            .map(([key]) => (
                              <span key={key} className="permission-tag">
                                {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                              </span>
                            ))
                          }
                          {(!staff.permissions || Object.values(staff.permissions).every(v => !v)) && 
                            <span className="no-permissions">Restricted Access</span>
                          }
                          {Array.isArray(staff.pageAccess) && staff.pageAccess.map((page) => (
                            <span key={page} className="permission-tag">
                              {page.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="staff-actions">
                           <button className="action-btn" onClick={() => handleEdit(staff)}>Edit</button>
                          <button className="action-btn login-btn" onClick={() => loginAs(staff.id)}>Login</button>
                          <button className="action-btn danger-btn" onClick={() => deleteStaffMember(staff.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan="4" className="staff-empty-state">
                        No staff members found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container animated">
            <div className="modal-header-gradient">
              <h3>{isEditing ? 'Update Staff Member' : 'Add New Staff Member'}</h3>
              <button className="close-modal" onClick={closeModal} aria-label="Close">&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="modal-section">
                  <h4>Personal Information</h4>
                  <div className="modal-grid">
                    <div className="form-group full-width">
                      <label htmlFor="fullName">Full Name</label>
                      <input type="text" id="fullName" name="fullName" value={formData.fullName} placeholder="e.g. John Doe" className="form-input-box" onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">Email Address</label>
                      <input type="email" id="email" name="email" value={formData.email} placeholder="name@example.com" className="form-input-box" onChange={handleChange} disabled={isEditing} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="phone">Phone Number</label>
                      <input type="text" id="phone" name="phone" value={formData.phone} placeholder="+91 0000000000" className="form-input-box" onChange={handleChange} />
                    </div>
                    {!isEditing && (
                      <div className="form-group full-width">
                        <label htmlFor="password">Login Password</label>
                        <input type="password" id="password" name="password" value={formData.password} placeholder="Minimum 6 characters" className="form-input-box" onChange={handleChange} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-section">
                  <h4>Platform Access & Permissions</h4>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <button type="button" className="action-btn success-btn" onClick={() => setAllPermissions(true)}>
                      Grant Full Access
                    </button>
                    <button type="button" className="action-btn warning-btn" onClick={() => setAllPermissions(false)}>
                      Remove All Access
                    </button>
                    <button type="button" className="action-btn success-btn" onClick={() => setAllPages(true)}>
                      Select All Pages
                    </button>
                    <button type="button" className="action-btn warning-btn" onClick={() => setAllPages(false)}>
                      Clear Pages
                    </button>
                  </div>
                  <div className="permissions-grid">
                    {permissionOptions.map(perm => (
                      <label key={perm.key} className="permission-item">
                        <input 
                          type="checkbox" 
                          name={`perm_${perm.key}`} 
                          checked={formData.permissions[perm.key]} 
                          onChange={handleChange} 
                        />
                        <div className="permission-info">
                          <span className="p-title">{perm.title}</span>
                          <span className="p-desc">{perm.desc}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ marginBottom: '12px' }}>Page Access Filter</h4>
                    <div className="permissions-grid">
                      {pageOptions.map((page) => (
                        <label key={page.key} className="permission-item">
                          <input
                            type="checkbox"
                            name={`page_${page.key}`}
                            checked={(formData.pageAccess || []).includes(page.key)}
                            onChange={handleChange}
                          />
                          <div className="permission-info">
                            <span className="p-title">{page.title}</span>
                            <span className="p-desc">Allow this staff member to open the {page.title} page.</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-create">{isEditing ? 'Update Staff' : 'Create Staff Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementPage;
