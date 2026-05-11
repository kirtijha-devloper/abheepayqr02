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
const MasterDashboard = lazy(() => import('./pages/MasterDashboard'));
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
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const ChargesPage = lazy(() => import('./pages/ChargesPage'));
const HierarchyUsersPage = lazy(() => import('./pages/HierarchyUsersPage'));
const StaffManagementPage = lazy(() => import('./pages/StaffManagementPage'));
const AdminLedgerPage = lazy(() => import('./pages/AdminLedgerPage'));
const UserLedgerPage = lazy(() => import('./pages/UserLedgerPage'));
const BeneficiariesPage = lazy(() => import('./pages/BeneficiariesPage'));

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

                  <Route path="/dashboard" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="dashboard"><DashboardPage /></ProtectedRoute>} />
                  <Route path="/transactions" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="transactions"><TransactionsPage /></ProtectedRoute>} />
                  <Route path="/reports" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="reports"><ReportsPage /></ProtectedRoute>} />
                  <Route path="/qr-codes" element={<ProtectedRoute requiredRole={["branch"]} requiredFeature="qr_codes"><QrCodesPage /></ProtectedRoute>} />
                  <Route path="/merchant/qr-codes" element={<ProtectedRoute requiredRole={["merchant"]} requiredFeature="qr_codes"><QrCodesPage /></ProtectedRoute>} />
                  <Route path="/wallet" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="wallet"><WalletPage /></ProtectedRoute>} />
                  <Route path="/beneficiaries" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="wallet"><BeneficiariesPage /></ProtectedRoute>} />
                  <Route path="/ledger" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="ledger"><UserLedgerPage /></ProtectedRoute>} />
                  <Route path="/api-services" element={<ProtectedRoute requiredRole="merchant"><ApiServicesPage /></ProtectedRoute>} />
                  <Route path="/branches" element={<ProtectedRoute requiredRole="merchant" requiredFeature="branches"><MerchantsPage /></ProtectedRoute>} />
                  <Route path="/callbacks" element={<ProtectedRoute requiredRole="merchant" requiredFeature="callbacks"><CallbacksPage /></ProtectedRoute>} />
                  <Route path="/support" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="support"><SupportPage /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute requiredRole={["merchant", "branch"]} requiredFeature="settings"><MerchantSettingsPage /></ProtectedRoute>} />
                  <Route path="/reconciliation" element={<ProtectedRoute requiredRole="merchant" requiredFeature="reconciliation"><ReconciliationPage /></ProtectedRoute>} />
                  <Route path="/settlements" element={<ProtectedRoute requiredRole="merchant" requiredFeature="settlements"><SettlementsAdminPage /></ProtectedRoute>} />
                  <Route path="/fund-requests" element={<ProtectedRoute requiredRole="merchant" requiredFeature="fund_requests"><FundRequestsAdminPage /></ProtectedRoute>} />
                  <Route path="/charges" element={<ProtectedRoute requiredRole="merchant" requiredFeature="charges"><ChargesPage /></ProtectedRoute>} />

                  <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPage="dashboard" requiredFeature="dashboard"><AdminDashboard /></ProtectedRoute>} />
                  <Route path="/admin/transactions" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canViewReports" requiredPage="transactions" requiredFeature="transactions"><TransactionsPage /></ProtectedRoute>} />
                  <Route path="/admin/merchants" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageUsers" requiredPage="masters" requiredFeature="masters"><MerchantsPage /></ProtectedRoute>} />
                  <Route path="/admin/wallet" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageFinances" requiredPage="wallet" requiredFeature="wallet"><WalletPage /></ProtectedRoute>} />
                  <Route path="/admin/reconciliation" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageFinances" requiredPage="reconciliation" requiredFeature="reconciliation"><ReconciliationPage /></ProtectedRoute>} />
                  <Route path="/admin/settlements" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageFinances" requiredPage="settlements" requiredFeature="settlements"><SettlementsAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/fund-requests" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageFinances" requiredPage="fund_requests" requiredFeature="fund_requests"><FundRequestsAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/qr-codes" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageServices" requiredPage="qr_codes" requiredFeature="qr_codes"><QrCodesAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/callbacks" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageServices" requiredPage="callbacks" requiredFeature="callbacks"><CallbacksPage /></ProtectedRoute>} />
                  <Route path="/admin/support" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canViewReports" requiredPage="support" requiredFeature="support"><SupportAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/settings" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageSettings" requiredPage="settings" requiredFeature="settings"><AdminSettingsPage /></ProtectedRoute>} />
                  <Route path="/admin/reports" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canViewReports" requiredPage="reports" requiredFeature="reports"><AdminReportsPage /></ProtectedRoute>} />
                  <Route path="/admin/ledger" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canViewReports" requiredPage="ledger" requiredFeature="ledger"><AdminLedgerPage /></ProtectedRoute>} />
                  <Route path="/admin/charges" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageCommissions" requiredPage="charges" requiredFeature="charges"><ChargesPage /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageUsers" requiredPage="users" requiredFeature="users"><HierarchyUsersPage /></ProtectedRoute>} />
                  <Route path="/admin/staff" element={<ProtectedRoute requiredRole={["admin", "staff"]} requiredPermission="canManageSecurity"><StaffManagementPage /></ProtectedRoute>} />
                  
                  {/* Master Specific */}
                  <Route path="/master/dashboard" element={<ProtectedRoute requiredRole="master" requiredFeature="dashboard"><MasterDashboard /></ProtectedRoute>} />
                  <Route path="/master/transactions" element={<ProtectedRoute requiredRole="master" requiredFeature="transactions"><TransactionsPage /></ProtectedRoute>} />
                  <Route path="/master/merchants" element={<ProtectedRoute requiredRole="master" requiredFeature="merchants"><MerchantsPage /></ProtectedRoute>} />
                  <Route path="/master/wallet" element={<ProtectedRoute requiredRole="master" requiredFeature="wallet"><WalletPage /></ProtectedRoute>} />
                  <Route path="/master/beneficiaries" element={<ProtectedRoute requiredRole="master" requiredFeature="wallet"><BeneficiariesPage /></ProtectedRoute>} />
                  <Route path="/master/ledger" element={<ProtectedRoute requiredRole="master" requiredFeature="ledger"><UserLedgerPage /></ProtectedRoute>} />
                  <Route path="/master/reconciliation" element={<ProtectedRoute requiredRole="master" requiredFeature="reconciliation"><ReconciliationPage /></ProtectedRoute>} />
                  <Route path="/master/settlements" element={<ProtectedRoute requiredRole="master" requiredFeature="settlements"><SettlementsAdminPage /></ProtectedRoute>} />
                  <Route path="/master/fund-requests" element={<ProtectedRoute requiredRole="master" requiredFeature="fund_requests"><FundRequestsAdminPage /></ProtectedRoute>} />
                  <Route path="/master/qr-codes" element={<ProtectedRoute requiredRole="master" requiredFeature="qr_codes"><QrCodesPage /></ProtectedRoute>} />
                  <Route path="/master/callbacks" element={<ProtectedRoute requiredRole="master" requiredFeature="callbacks"><CallbacksPage /></ProtectedRoute>} />
                  <Route path="/master/support" element={<ProtectedRoute requiredRole="master" requiredFeature="support"><SupportAdminPage /></ProtectedRoute>} />
                  <Route path="/master/settings" element={<ProtectedRoute requiredRole="master" requiredFeature="settings"><AdminSettingsPage /></ProtectedRoute>} />
                  <Route path="/master/reports" element={<ProtectedRoute requiredRole="master" requiredFeature="reports"><ReportsPage /></ProtectedRoute>} />
                  <Route path="/master/charges" element={<ProtectedRoute requiredRole="master" requiredFeature="charges"><ChargesPage /></ProtectedRoute>} />

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
