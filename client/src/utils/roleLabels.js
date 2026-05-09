const ROLE_LABELS = {
  admin: 'Admin',
  staff: 'Staff',
  master: 'Super Distributor',
  merchant: 'Distributor',
  branch: 'Branch',
  retailer: 'Retailer',
};

const ROLE_PLURALS = {
  admin: 'Admins',
  staff: 'Staff',
  master: 'Super Distributors',
  merchant: 'Distributors',
  branch: 'Branches',
  retailer: 'Retailers',
};

export const formatRoleLabel = (role = '') => ROLE_LABELS[String(role || '').toLowerCase()] || role || 'User';

export const formatRolePlural = (role = '') => ROLE_PLURALS[String(role || '').toLowerCase()] || role || 'Users';

export const normalizeLegacyRoleText = (value = '') =>
  String(value || '')
    .replace(/\bMasters\b/g, 'Super Distributors')
    .replace(/\bMaster\b/g, 'Super Distributor')
    .replace(/\bMerchants\b/g, 'Distributors')
    .replace(/\bMerchant\b/g, 'Distributor');
