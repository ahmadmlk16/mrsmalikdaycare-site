(() => {
  const header = document.querySelector('.site-header');
  const nav = document.getElementById('site-nav');
  const toggle = document.querySelector('.nav-toggle');

  // Mobile menu
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  nav?.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    }
  });

  // Header border on scroll
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight the nav link for the section on screen
  const links = [...document.querySelectorAll('[data-nav]')];
  const sections = links.map((a) => document.getElementById(a.dataset.nav)).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            links.forEach((a) => a.classList.toggle('active', a.dataset.nav === entry.target.id));
          }
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    sections.forEach((s) => io.observe(s));
  }

  // Inquiry form
  const form = document.getElementById('inquiry-form');
  if (form) {
    const status = form.querySelector('.form-status');
    const msgLabel = form.querySelector('.msg-label');
    const button = form.querySelector('button[type=submit]');
    const setKind = (kind) => {
      form.querySelector(`input[name=kind][value=${kind}]`).checked = true;
      form.classList.toggle('is-question', kind === 'question');
      msgLabel.textContent = kind === 'question' ? 'Your question *' : 'Anything we should know? (optional)';
      button.textContent = kind === 'question' ? 'Send question' : 'Request a visit';
    };
    form.addEventListener('change', (e) => {
      if (e.target.name === 'kind') setKind(e.target.value);
    });
    document.querySelectorAll('[data-kind]').forEach((a) =>
      a.addEventListener('click', () => setKind(a.dataset.kind)),
    );
    setKind('tour');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      status.className = 'form-status';
      if (!data.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        status.textContent = 'Please enter your name and a valid email.';
        status.classList.add('err');
        return;
      }
      if (data.kind === 'question' && !data.message.trim()) {
        status.textContent = 'Please type your question.';
        status.classList.add('err');
        return;
      }
      button.disabled = true;
      status.textContent = 'Sending…';
      try {
        const res = await fetch('/api/inquiry', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(data),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || 'Something went wrong.');
        form.reset();
        setKind(data.kind);
        status.textContent =
          data.kind === 'tour'
            ? "Thank you! We'll reach out soon to set up your visit."
            : "Thank you! We'll get back to you soon.";
        status.classList.add('ok');
      } catch (err) {
        status.textContent = err.message + ' You can also call or email us directly.';
        status.classList.add('err');
      } finally {
        button.disabled = false;
      }
    });
  }

  // Google reviews (loaded after the page so it stays fast)
  const reviewsSection = document.getElementById('reviews');
  if (reviewsSection) {
    const esc = (v) =>
      String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const stars = (n) => {
      const full = Math.round(n);
      return `<span class="stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(full)}<span class="off">${'★'.repeat(5 - full)}</span></span>`;
    };
    const safeUrl = (u) => (/^https:\/\//.test(u || '') ? u : '');
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((d) => {
        if (!d.enabled) {
          document.querySelector('[data-nav="reviews"]')?.remove();
          return;
        }
        reviewsSection.querySelector('.rating-summary').innerHTML = d.rating
          ? `<span class="big">${d.rating.toFixed(1)}</span> ${stars(d.rating)} <span class="muted">${d.count} Google review${d.count === 1 ? '' : 's'}</span>`
          : '';
        reviewsSection.querySelector('.reviews-grid').innerHTML = d.reviews
          .filter((r) => r.text)
          .map(
            (r) => `<article class="review">
              <header>
                ${safeUrl(r.authorPhoto) ? `<img src="${esc(r.authorPhoto)}" alt="" width="40" height="40" referrerpolicy="no-referrer" loading="lazy">` : `<span class="avatar">${esc(r.author[0] || '?')}</span>`}
                <div>
                  ${safeUrl(r.authorUrl) ? `<a href="${esc(r.authorUrl)}" target="_blank" rel="noopener">${esc(r.author)}</a>` : `<b>${esc(r.author)}</b>`}
                  <div>${stars(r.rating)} <span class="muted">${esc(r.when)}</span></div>
                </div>
              </header>
              <p class="review-text">${esc(r.text)}</p>
              <button type="button" class="read-more" hidden>Read more</button>
            </article>`,
          )
          .join('');
        reviewsSection.querySelector('.reviews-actions').innerHTML = `
          <a class="btn btn-secondary" href="${esc(safeUrl(d.mapsUrl))}" target="_blank" rel="noopener">See all reviews on Google</a>
          <a class="btn btn-primary" href="${esc(safeUrl(d.writeReviewUrl))}" target="_blank" rel="noopener">Write a review</a>`;
        reviewsSection.hidden = false;
        reviewsSection.querySelectorAll('.review').forEach((card) => {
          const text = card.querySelector('.review-text');
          const more = card.querySelector('.read-more');
          if (text.scrollHeight > text.clientHeight + 2) {
            more.hidden = false;
            more.onclick = () => {
              const open = text.classList.toggle('open');
              more.textContent = open ? 'Show less' : 'Read more';
            };
          }
        });
      })
      .catch(() => document.querySelector('[data-nav="reviews"]')?.remove());
  }

  // Gallery lightbox
  const lb = document.getElementById('lightbox');
  const photos = window.GALLERY || [];
  if (lb && photos.length) {
    const img = lb.querySelector('img');
    const cap = lb.querySelector('figcaption');
    let index = 0;
    let lastFocus = null;
    const show = (i) => {
      index = (i + photos.length) % photos.length;
      img.src = photos[index].src;
      img.alt = photos[index].caption || 'Daycare photo';
      cap.textContent = photos[index].caption || '';
    };
    const open = (i) => {
      lastFocus = document.activeElement;
      show(i);
      lb.hidden = false;
      document.body.style.overflow = 'hidden';
      lb.querySelector('.lb-close').focus();
    };
    const close = () => {
      lb.hidden = true;
      document.body.style.overflow = '';
      lastFocus?.focus();
    };
    document.querySelectorAll('.gallery-open').forEach((b) =>
      b.addEventListener('click', () => open(Number(b.dataset.index))),
    );
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', () => show(index - 1));
    lb.querySelector('.lb-next').addEventListener('click', () => show(index + 1));
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.tagName === 'FIGURE') close();
    });
    document.addEventListener('keydown', (e) => {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
  }
})();
