import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import './SupportPage.css';

const API_BASE = 'http://localhost:4001/api';

const SupportPage = () => {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // New Ticket Form State
    const [formData, setFormData] = useState({
        subject: '',
        message: '',
        category: 'general'
    });
    
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/support/tickets`, {
                headers: { 'Authorization': `Bearer ${token}` },
                credentials: 'include'
            });
            if (!res.ok) throw new Error("Failed to fetch tickets");
            const data = await res.json();
            setTickets(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setStatusMsg({ type: '', text: '' });

        try {
            const token = sessionStorage.getItem('authToken');
            const res = await fetch(`${API_BASE}/support/tickets`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData),
                credentials: 'include'
            });

            if (!res.ok) throw new Error("Submission failed");
            
            setStatusMsg({ type: 'success', text: 'Support ticket submitted successfully!' });
            setFormData({ subject: '', message: '', category: 'general' });
            fetchTickets();
        } catch (err) {
            setStatusMsg({ type: 'error', text: 'Error: ' + err.message });
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
                            <h1>Contact Support</h1>
                            <p>Get help from our team — we respond within 24 hours</p>
                        </div>
                    </header>

                    <div className="support-grid">
                        <section className="support-card main-logs">
                            <h2>Your Support Tickets</h2>
                            <div className="ticket-list-container">
                                {loading ? (
                                    <p>Loading tickets...</p>
                                ) : !Array.isArray(tickets) || tickets.length === 0 ? (
                                    <div className="empty-state">
                                        <p>No tickets found. Submit one on the right!</p>
                                    </div>
                                ) : (
                                    <div className="ticket-list">
                                        {tickets.map(ticket => (
                                            <div key={ticket.id} className="ticket-item">
                                                <div className="ticket-main">
                                                    <div className="ticket-info">
                                                        <h3>{ticket.subject}</h3>
                                                        <div className="ticket-meta">
                                                            <span className="category-tag">{ticket.category}</span>
                                                            <span>•</span>
                                                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`status-pill ${ticket.status.toLowerCase()}`}>
                                                        {ticket.status}
                                                    </span>
                                                </div>
                                                <p className="ticket-msg" style={{fontSize: '14px', color: '#475569', margin: '12px 0'}}>{ticket.message}</p>
                                                {ticket.adminReply && (
                                                    <div className="admin-response">
                                                        <h4><span className="reply-icon">💬</span> Support Response</h4>
                                                        <p>{ticket.adminReply}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        <aside className="support-card">
                            <h2>Submit New Ticket</h2>
                            <form className="support-form" onSubmit={handleSubmit}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Category</label>
                                        <select 
                                            value={formData.category}
                                            onChange={(e) => setFormData({...formData, category: e.target.value})}
                                        >
                                            <option value="general">General Inquiry</option>
                                            <option value="technical">Technical Issue</option>
                                            <option value="billing">Billing/Wallet</option>
                                            <option value="kyc">KYC Related</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Subject</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Brief summary"
                                            value={formData.subject}
                                            onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Message</label>
                                    <textarea 
                                        required
                                        placeholder="Describe your issue in detail..."
                                        value={formData.message}
                                        onChange={(e) => setFormData({...formData, message: e.target.value})}
                                        style={{minHeight: '150px'}}
                                    />
                                </div>
                                <button type="submit" className="btn-primary-support" disabled={submitting}>
                                    {submitting ? 'Submitting...' : 'Send Message'}
                                </button>
                                {statusMsg.text && (
                                    <div className={`status-msg ${statusMsg.type}`}>
                                        {statusMsg.text}
                                    </div>
                                )}
                            </form>
                        </aside>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
