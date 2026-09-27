// Extra contact details stored as JSON on each user (users.profile).
import { str } from './util.js';

export const FAMILY_FIELDS = {
  phone: 60,
  altPhone: 60,
  address: 300,
  emergencyName: 100,
  emergencyRelationship: 60,
  emergencyPhone: 60,
  notes: 2000,
};

export const ADMIN_FIELDS = {
  phone: 60,
};

export function parseProfile(value) {
  try {
    const p = JSON.parse(value || '{}');
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

// Keep only the known fields for the role, trimmed to sane lengths.
export function cleanProfile(role, input, existing = {}) {
  const fields = role === 'admin' ? ADMIN_FIELDS : FAMILY_FIELDS;
  const out = {};
  for (const [key, max] of Object.entries(fields)) {
    const value = input && input[key] !== undefined ? input[key] : existing[key];
    out[key] = str(value, max);
  }
  if (role === 'admin') {
    const notify = input && input.notifyEmail !== undefined ? input.notifyEmail : existing.notifyEmail;
    out.notifyEmail = notify !== false;
  }
  return out;
}
