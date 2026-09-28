// The /documents page: forms and papers parents can download and fill out.
import { esc } from './util.js';
import { pageShell } from './page-shell.js';
import { fmtSize } from './documents.js';

const KIND = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', xls: 'XLS', xlsx: 'XLS', csv: 'XLS', ppt: 'PPT', pptx: 'PPT', jpg: 'IMG', jpeg: 'IMG', png: 'IMG', heic: 'IMG', txt: 'TXT', rtf: 'DOC' };
export const fileKind = (ext) => KIND[ext] || 'FILE';

export function documentRow(doc) {
  const kind = fileKind(doc.ext);
  const viewable = ['pdf', 'jpg', 'jpeg', 'png'].includes(doc.ext);
  return `
        <li class="doc-row">
          <span class="doc-icon doc-${kind.toLowerCase()}" aria-hidden="true">${kind}</span>
          <div class="doc-text">
            <strong>${esc(doc.title)}</strong>
            ${doc.description ? `<span class="doc-desc">${esc(doc.description)}</span>` : ''}
            <span class="doc-meta">${esc(doc.ext.toUpperCase())} · ${fmtSize(doc.size)}</span>
          </div>
          <div class="doc-actions">
            ${viewable ? `<a class="btn btn-ghost btn-sm" href="${esc(doc.url)}" target="_blank" rel="noopener">View</a>` : ''}
            <a class="btn btn-primary btn-sm" href="${esc(doc.url)}?download=1" download>Download</a>
          </div>
        </li>`;
}

export function renderDocuments(site, documents, { loggedIn = null } = {}) {
  const groups = new Map();
  for (const doc of documents) {
    const key = doc.category || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  // Uncategorized first, then categories in the order they first appear.
  const ordered = [...groups].sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : 0));
  const list = documents.length
    ? ordered
        .map(
          ([cat, docs]) => `
      ${cat ? `<h2 class="doc-group">${esc(cat)}</h2>` : ''}
      <ul class="doc-list">${docs.map(documentRow).join('')}</ul>`,
        )
        .join('')
    : `<div class="empty-card"><p>No documents have been posted yet.</p></div>`;

  return pageShell(site, {
    title: 'Documents',
    description: `Forms and documents for ${site.name} families.`,
    bodyClass: 'page-documents',
    loggedIn,
    adminHref: '/admin#documents',
    content: `
  <section class="section documents-page">
    <div class="container documents-inner">
      <div class="section-head">
        <p class="eyebrow">Forms</p>
        <h1>Documents</h1>
        <p class="muted">Forms and papers you may need. Download, fill out, and bring them in or email them back to us${
          site.email ? ` at <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ''
        }.</p>
      </div>
      ${list}
      ${loggedIn === 'family' ? `<p class="closures-foot muted">Looking for your signed forms? They're in <a href="/portal#documents">your family portal</a>.</p>` : ''}
    </div>
  </section>`,
  });
}
