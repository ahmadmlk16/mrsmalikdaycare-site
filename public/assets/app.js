// Shared helpers for login, admin, and portal pages.
window.App = (() => {
  async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
    const opts = { method, headers: { ...headers }, credentials: 'same-origin' };
    if (body !== undefined) {
      if (body instanceof Blob || body instanceof ArrayBuffer) {
        opts.body = body;
      } else {
        opts.headers['content-type'] = 'application/json';
        opts.body = JSON.stringify(body);
      }
    }
    const res = await fetch(path, opts);
    if (raw) return res;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  let toastTimer;
  function toast(message, isError = false) {
    document.querySelector('.toast')?.remove();
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' err' : '');
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), isError ? 6000 : 3000);
  }

  function modal(html, { onMount } = {}) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-backdrop';
      back.innerHTML = `<div class="card modal" role="dialog" aria-modal="true">${html}</div>`;
      const prevFocus = document.activeElement;
      const close = (value) => {
        back.remove();
        document.removeEventListener('keydown', onKey);
        prevFocus?.focus?.();
        resolve(value);
      };
      const onKey = (e) => e.key === 'Escape' && close(null);
      document.addEventListener('keydown', onKey);
      back.addEventListener('click', (e) => {
        if (e.target === back) close(null);
        const btn = e.target.closest('[data-close]');
        if (btn) close(btn.dataset.close);
      });
      document.body.appendChild(back);
      onMount?.(back.querySelector('.modal'), close);
      (back.querySelector('[autofocus]') || back.querySelector('button'))?.focus();
    });
  }

  async function confirmDialog(title, text, okLabel = 'Delete') {
    const r = await modal(`
      <h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn" data-close="no">Cancel</button>
        <button class="btn btn-primary" data-close="yes" autofocus>${esc(okLabel)}</button>
      </div>`);
    return r === 'yes';
  }

  // Shrink photos in the browser before uploading (faster uploads, less storage).
  async function resizeImage(file, maxSize = 2000, quality = 0.85) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new Error(`Couldn't read "${file.name}". Please use a JPG or PNG photo.`);
    }
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error(`Couldn't process "${file.name}".`);
    return { blob, width: w, height: h };
  }

  async function uploadPhoto(file, { scope, familyId, caption = '' }) {
    const { blob, width, height } = await resizeImage(file);
    const q = new URLSearchParams({ scope, w: width, h: height, caption });
    if (familyId) q.set('familyId', familyId);
    const { photo } = await api(`/api/admin/photos?${q}`, {
      method: 'POST',
      body: blob,
      headers: { 'content-type': 'image/jpeg' },
    });
    return photo;
  }

  function pickFiles({ multiple = true } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = multiple;
      input.onchange = () => resolve([...input.files]);
      input.click();
    });
  }

  function lightbox(photos, start, { download = false } = {}) {
    let i = start;
    const el = document.createElement('div');
    el.className = 'lightbox';
    el.innerHTML = `
      <button class="close" aria-label="Close">&times;</button>
      <button class="nav prev" aria-label="Previous">&#8249;</button>
      <figure><img alt=""><figcaption></figcaption></figure>
      <button class="nav next" aria-label="Next">&#8250;</button>`;
    const img = el.querySelector('img');
    const cap = el.querySelector('figcaption');
    const show = () => {
      i = (i + photos.length) % photos.length;
      const p = photos[i];
      img.src = p.url;
      img.alt = p.caption || 'Photo';
      cap.innerHTML = `${p.caption ? `<span>${esc(p.caption)}</span>` : ''}${
        download ? `<a class="btn btn-sm" href="${esc(p.url)}?download=1">Download photo</a>` : ''
      }`;
    };
    const close = () => {
      el.remove();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') (i--, show());
      if (e.key === 'ArrowRight') (i++, show());
    };
    el.querySelector('.close').onclick = close;
    el.querySelector('.prev').onclick = () => (i--, show());
    el.querySelector('.next').onclick = () => (i++, show());
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target.tagName === 'FIGURE') close();
    });
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    document.body.appendChild(el);
    show();
    el.querySelector('.close').focus();
  }

  const fmtDate = (sec) =>
    sec
      ? new Date(sec * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      : 'Never';

  async function logout() {
    await api('/api/logout', { method: 'POST' }).catch(() => {});
    location.href = '/login';
  }

  return { api, esc, toast, modal, confirmDialog, uploadPhoto, pickFiles, lightbox, fmtDate, logout };
})();
