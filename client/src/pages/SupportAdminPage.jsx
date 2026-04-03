import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './SupportPage.css';

import { API_BASE } from '../config';

const SupportAdminPage = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [statusUpdate, setStatusUpdate] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchTickets();
    }, []);

    const [error, setError] = useState(null);

    const fetchTickets = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/support/tickets`, {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to fetch tickets");
            setTickets(data);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (ticket) => {
        setSelectedTicket(ticket);
        setReplyText(ticket.adminReply || '');
        setStatusUpdate(ticket.status);
    };

    const handleReply = async () => {
        if (!replyText) return;
        setSubmitting(true);
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/support/tickets/${selectedTicket.id}/reply`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    reply_text: replyText,
                    status: statusUpdate 
                }),
                credentials: 'include'
            });

            if (!res.ok) throw new Error("Reply failed");
            
            setSelectedTicket(null);
            fetchTickets();
        } catch (err) {
            alert(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="app-container">
            <Sidebar />
            <div className="main-content">
                <Header />
                <div className="support-container">
                    <header className="support-header">
                        <div className="support-header-icon">🎫</div>
                        <div>
                            <h1>Support Management</h1>
                            <p>Review and respond to merchant inquiries</p>
                        </div>
                    </header>

                    <section className="support-card admin-mode">
                        <h2>Support Tickets Management</h2>
                        <div className="tickets-table-container">
                            {loading ? (
                                <p>Loading tickets...</p>
                            ) : error ? (
                                <div className="error-state">
                                    <strong>Error:</strong> {error}
                                    <button onClick={fetchTickets}>Retry</button>
                                </div>
                            ) : !Array.isArray(tickets) || tickets.length === 0 ? (
                                <p className="empty-state">No tickets to manage yet.</p>
                            ) : (
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Merchant</th>
                                            <th>Subject</th>
                                            <th>Category</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tickets.map(ticket => (
                                            <tr key={ticket.id}>
                                                <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
                                                <td>
                                                    <div className="merchant-meta">
                                                        <span className="merchant-name">{ticket.user?.profile?.businessName || ticket.user?.profile?.fullName || 'Individual'}</span>
                                                        <span className="merchant-email">{ticket.user?.email}</span>
                                                    </div>
                                                </td>
                                                <td><span style={{fontWeight: 600}}>{ticket.subject}</span></td>
                                                <td><span className="category-tag">{ticket.category}</span></td>
                                                <td>
                                                    <span className={`status-pill ${ticket.status.toLowerCase()}`}>
                                                        {ticket.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <button className="action-btn btn-reply" onClick={() => handleOpenModal(ticket)}>
                                                        {ticket.adminReply ? 'Update Reply' : 'Reply'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>

                    {selectedTicket && (
                        <div className="reply-modal-overlay">
                            <div className="reply-modal">
                                <h3>Manage Support Ticket</h3>
                                
                                <div className="ticket-context">
                                    <strong>Merchant Message</strong>
                                    <p>{selectedTicket.message}</p>
                                </div>

                                <div className="support-form">
                                    <div className="form-group">
                                        <label>Your Reply</label>
                                        <textarea 
                                            placeholder="Type your response to the merchant..."
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            style={{minHeight: '150px'}}
                                        />
                                    </div>
                                    <div className="form-group" style={{marginTop: '16px'}}>
                                        <label>Update Status</label>
                                        <select 
                                            value={statusUpdate}
                                            onChange={(e) => setStatusUpdate(e.target.value)}
                                            style={{width: '100%'}}
                                        >
                                            <option value="open">Open</option>
                                            <option value="resolved">Resolved</option>
                                            <option value="closed">Closed</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button className="btn-cancel" onClick={() => setSelectedTicket(null)}>Discard</button>
                                    <button className="btn-primary-support" style={{width: 'auto'}} onClick={handleReply} disabled={submitting}>
                                        {submitting ? 'Saving...' : 'Send Reply'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupportAdminPage;
