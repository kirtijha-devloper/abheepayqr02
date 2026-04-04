import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'));
const QrCodesPage = lazy(() => import('./pages/QrCodesPage'));
const WalletPage = lazy(() => import('./pages/WalletPage'));
const ApiServicesPage = lazy(() => import('./pages/ApiServicesPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const MerchantsPage = lazy(() => import('./pages/MerchantsPage'));
const ReconciliationPage = lazy(() => import('./pages/ReconciliationPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const QrCodesAdminPage = lazy(() => import('./pages/QrCodesAdminPage'));
const SettlementsAdminPage = lazy(() => import('./pages/SettlementsAdminPage'));
const FundRequestsAdminPage = lazy(() => import('./pages/FundRequestsAdminPage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));
const MerchantSettingsPage = lazy(() => import('./pages/MerchantSettingsPage'));
const CallbacksPage = lazy(() => import('./pages/CallbacksPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const SupportAdminPage = lazy(() => import('./pages/SupportAdminPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));

const RouteLoader = () => (
  <div className="route-loader-shell">
    <div className="route-loader-card">
      <div className="route-loader-spinner" />
      <p>Loading workspace…</p>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppProvider>
            <Router>
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/admin/login" element={<LoginPage />} />

                  <Route path="/dashboard" element={<ProtectedRoute requiredRole="merchant"><DashboardPage /></ProtectedRoute>} />
                  <Route path="/transactions" element={<ProtectedRoute requiredRole="merchant"><TransactionsPage /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute requiredRole="merchant"><ReportsPage /></ProtectedRoute>} />
                  <Route path="/qr-codes" element={<ProtectedRoute requiredRole="merchant"><QrCodesPage /></ProtectedRoute>} />
                  <Route path="/wallet" element={<ProtectedRoute requiredRole="merchant"><WalletPage /></ProtectedRoute>} />
                  <Route path="/api-services" element={<ProtectedRoute requiredRole="merchant"><ApiServicesPage /></ProtectedRoute>} />
                  <Route path="/callbacks" element={<ProtectedRoute requiredRole="merchant"><CallbacksPage /></ProtectedRoute>} />
                  <Route path="/support" element={<ProtectedRoute requiredRole="merchant"><SupportPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute requiredRole="merchant"><MerchantSettingsPage /></ProtectedRoute>} />

                  <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/transactions" element={<ProtectedRoute requiredRole="admin"><TransactionsPage /></ProtectedRoute>} />
                  <Route path="/admin/merchants" element={<ProtectedRoute requiredRole="admin"><MerchantsPage /></ProtectedRoute>} />
                  <Route path="/admin/wallet" element={<ProtectedRoute requiredRole="admin"><WalletPage /></ProtectedRoute>} />
                  <Route path="/admin/reconciliation" element={<ProtectedRoute requiredRole="admin"><ReconciliationPage /></ProtectedRoute>} />
                  <Route path="/admin/settlements" element={<ProtectedRoute requiredRole="admin"><SettlementsAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/fund-requests" element={<ProtectedRoute requiredRole="admin"><FundRequestsAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/qr-codes" element={<ProtectedRoute requiredRole="admin"><QrCodesAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/callbacks" element={<ProtectedRoute requiredRole="admin"><CallbacksPage /></ProtectedRoute>} />
                  <Route path="/admin/support" element={<ProtectedRoute requiredRole="admin"><SupportAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/settings" element={<ProtectedRoute requiredRole="admin"><AdminSettingsPage /></ProtectedRoute>} />

                  <Route path="/docs" element={<DocsPage />} />

                  <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
                  <Route path="/" element={<Navigate to="/login" replace />} />
                </Routes>
              </Suspense>
            </Router>
          </AppProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
