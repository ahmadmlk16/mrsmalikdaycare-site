// Document center: downloadable forms for everyone (scope 'public', shown on
// /documents) and private files for one family (scope 'family', e.g. signed
// enrollment forms or yearly tax statements). Files live in R2 next to photos.

export const MAX_DOC = 25 * 1024 * 1024; // 25 MB

// Only these file types can be uploaded. The type is decided from the file
// extension on the server, never from what the browser claims.
export const DOC_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  rtf: 'application/rtf',
  txt: 'text/plain',
  csv: 'text/csv',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

export const FAMILY_CATEGORIES = ['Signed forms', 'Tax statements', 'Receipts & invoices', 'Medical & immunization', 'Other'];

export function extOf(name) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

// A safe download name: keep letters, numbers, spaces, dashes, dots.
export function safeFilename(name, fallback = 'document') {
  const ext = extOf(name);
  let base = String(name || '')
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  if (!base) base = fallback;
  return ext ? `${base}.${ext}` : base;
}

export function docOut(d) {
  return {
    id: d.id,
    scope: d.scope,
    familyId: d.family_id,
    title: d.title,
    description: d.description,
    category: d.category,
    filename: d.filename,
    ext: extOf(d.filename),
    contentType: d.content_type,
    size: d.size,
    createdAt: d.created_at,
    url: `/files/${d.id}/${encodeURIComponent(d.filename)}`,
  };
}

export function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
