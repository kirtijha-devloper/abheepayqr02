import React, { useEffect, useState } from 'react';
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
  permissions: {
    canManageUsers: false,
    canManageFinances: false,
    canManageCommissions: false,
    canManageServices: false,
    canManageSettings: false,
    canManageSecurity: false,
    canViewReports: true,
  }
};

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
    const { name, value, type, checked } = e.target;
    if (name.startsWith('perm_')) {
      const permKey = name.replace('perm_', '');
      setFormData({
        ...formData,
        permissions: {
          ...formData.permissions,
          [permKey]: checked
        }
      });
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEditing && selectedStaff) {
      const res = await updateStaffMember(selectedStaff.id, {
        fullName: formData.fullName,
        phone: formData.phone,
        permissions: formData.permissions
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
      permissions: staff.permissions || emptyForm.permissions
    });
    setShowModal(true);
  };

  const filteredStaff = staffMembers.filter((staff) => {
    const term = searchTerm.toLowerCase();
    return !searchTerm || 
      staff.fullName?.toLowerCase().includes(term) || 
      staff.email?.toLowerCase().includes(term);
  });

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
              <div className="staff-search-wrap">
                <span className="staff-search-icon">Search</span>
                <input
                  type="text"
                  placeholder="by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Contact Info</th>
                    <th>Permissions</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar">{staff.fullName?.charAt(0).toUpperCase() || 'S'}</div>
                          <div className="staff-name-info">
                            <div className="s-name">{staff.fullName}</div>
                            <div className="s-id">ID: {staff.id.substring(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="s-email">{staff.email}</div>
                        <div className="s-phone">{staff.phone || 'No phone'}</div>
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
                        </div>
                      </td>
                      <td>
                        <div className="staff-actions">
                          <button className="action-btn" onClick={() => handleEdit(staff)}>Edit</button>
                          <button 
                            className={`action-btn ${staff.status === 'blocked' ? 'success-btn' : 'warning-btn'}`}
                            onClick={async () => {
                              const newStatus = staff.status === 'blocked' ? 'active' : 'blocked';
                              const res = await updateStaffMember(staff.id, { status: newStatus });
                              if (res.success) success(`Staff member ${newStatus === 'active' ? 'activated' : 'blocked'}.`);
                              else error(res.error || 'Update failed');
                            }}
                          >
                            {staff.status === 'blocked' ? 'Unblock' : 'Block'}
                          </button>
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
                      <input type="text" id="fullName" name="fullName" value={formData.fullName} placeholder="e.g. John Doe" className="form-input-box" required onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">Email Address</label>
                      <input type="email" id="email" name="email" value={formData.email} placeholder="name@example.com" className="form-input-box" required onChange={handleChange} disabled={isEditing} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="phone">Phone Number</label>
                      <input type="text" id="phone" name="phone" value={formData.phone} placeholder="+91 0000000000" className="form-input-box" onChange={handleChange} />
                    </div>
                    {!isEditing && (
                      <div className="form-group full-width">
                        <label htmlFor="password">Login Password</label>
                        <input type="password" id="password" name="password" value={formData.password} placeholder="Minimum 6 characters" className="form-input-box" required onChange={handleChange} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-section">
                  <h4>Platform Access & Permissions</h4>
                  <div className="permissions-grid">
                    {[
                      { key: 'canManageUsers', title: 'Manage Users', desc: 'Create and edit merchant accounts.' },
                      { key: 'canManageFinances', title: 'Manage Finances', desc: 'Approve fund requests & settlements.' },
                      { key: 'canManageCommissions', title: 'Commissions', desc: 'Set and override service slabs.' },
                      { key: 'canManageServices', title: 'Manage Services', desc: 'Control service availability & QRs.' },
                      { key: 'canViewReports', title: 'View Reports', desc: 'Access analytics and transaction logs.' },
                      { key: 'canManageSettings', title: 'System Settings', desc: 'Modify core platform configurations.' },
                    ].map(perm => (
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
