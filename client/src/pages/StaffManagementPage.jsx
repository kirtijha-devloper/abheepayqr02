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
  const { staffMembers, addStaffMember, updateStaffMember, deleteStaffMember, fetchStaffMembers } = useAppContext();
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
                <input
                  type="text"
                  placeholder="Search staff by name or email..."
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
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((staff) => (
                    <tr key={staff.id}>
                      <td>
                        <div className="staff-name-cell">
                          <div className="staff-avatar">{staff.fullName?.charAt(0) || 'S'}</div>
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
                            <span className="no-permissions">No Access</span>
                          }
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${staff.status || 'active'}`}>
                          {staff.status ? staff.status.toUpperCase() : 'ACTIVE'}
                        </span>
                      </td>
                      <td>
                        <div className="staff-actions">
                          <button className="action-btn" onClick={() => handleEdit(staff)}>Edit</button>
                          <button className="action-btn danger-btn" onClick={() => deleteStaffMember(staff.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan="5" className="staff-empty-state">
                        No staff members found.
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
          <div className="modal-container staff-modal">
            <div className="modal-header-gradient">
              <h3>{isEditing ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
              <button className="close-modal" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="modal-section">
                  <h4>Personal Details</h4>
                  <div className="modal-grid">
                    <div className="form-group full-width">
                      <label>Full Name</label>
                      <input type="text" name="fullName" value={formData.fullName} placeholder="John Doe" className="form-input-box" required onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label>Email Address</label>
                      <input type="email" name="email" value={formData.email} placeholder="john@example.com" className="form-input-box" required onChange={handleChange} disabled={isEditing} />
                    </div>
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input type="text" name="phone" value={formData.phone} placeholder="+91 0000000000" className="form-input-box" onChange={handleChange} />
                    </div>
                    {!isEditing && (
                      <div className="form-group full-width">
                        <label>Login Password</label>
                        <input type="password" name="password" value={formData.password} placeholder="••••••••" className="form-input-box" required onChange={handleChange} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-section">
                  <h4>Access Permissions</h4>
                  <div className="permissions-grid">
                    <label className="permission-item">
                      <input type="checkbox" name="perm_canManageUsers" checked={formData.permissions.canManageUsers} onChange={handleChange} />
                      <div className="permission-info">
                        <span className="p-title">Manage Users</span>
                        <span className="p-desc">Create, edit, and manage merchants and users.</span>
                      </div>
                    </label>
                    <label className="permission-item">
                      <input type="checkbox" name="perm_canManageFinances" checked={formData.permissions.canManageFinances} onChange={handleChange} />
                      <div className="permission-info">
                        <span className="p-title">Manage Finances</span>
                        <span className="p-desc">Approve fund requests and settlements.</span>
                      </div>
                    </label>
                    <label className="permission-item">
                      <input type="checkbox" name="perm_canManageCommissions" checked={formData.permissions.canManageCommissions} onChange={handleChange} />
                      <div className="permission-info">
                        <span className="p-title">Manage Commissions</span>
                        <span className="p-desc">Set and override commission slabs.</span>
                      </div>
                    </label>
                    <label className="permission-item">
                      <input type="checkbox" name="perm_canManageServices" checked={formData.permissions.canManageServices} onChange={handleChange} />
                      <div className="permission-info">
                        <span className="p-title">Manage Services</span>
                        <span className="p-desc">Enable/disable services and QR codes.</span>
                      </div>
                    </label>
                    <label className="permission-item">
                      <input type="checkbox" name="perm_canViewReports" checked={formData.permissions.canViewReports} onChange={handleChange} />
                      <div className="permission-info">
                        <span className="p-title">View Reports</span>
                        <span className="p-desc">Access transaction and financial reports.</span>
                      </div>
                    </label>
                    <label className="permission-item">
                      <input type="checkbox" name="perm_canManageSettings" checked={formData.permissions.canManageSettings} onChange={handleChange} />
                      <div className="permission-info">
                        <span className="p-title">System Settings</span>
                        <span className="p-desc">Modify core platform settings.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-create">{isEditing ? 'Save Changes' : 'Create Staff Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagementPage;
