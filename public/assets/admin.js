(async () => {
  const { api, esc, toast, modal, confirmDialog, uploadPhoto, pickFiles, lightbox, fmtDate, logout, familyProfileFields, formBody } = App;
  const main = document.getElementById('main');
  let me;
  let dirty = false;

  try {
    ({ user: me } = await api('/api/session'));
  } catch {}
  if (!me || me.role !== 'admin' || me.mustChangePassword) {
    location.href = '/login';
    return;
  }
  document.getElementById('shell').hidden = false;
  document.getElementById('who-name').textContent = me.name;
  document.getElementById('logout').onclick = logout;

  window.addEventListener('beforeunload', (e) => {
    if (dirty) e.preventDefault();
  });

  const TABS = { inquiries: renderInquiries, content: renderContent, closures: renderClosures, articles: renderArticles, gallery: renderGallery, families: renderFamilies, account: renderAccount };

  async function route() {
    const [tab, sub] = location.hash.slice(1).split('/');
    const name = TABS[tab] ? tab : 'inquiries';
    document.querySelectorAll('.sidenav button').forEach((b) => {
      if (b.dataset.tab === name) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    main.innerHTML = '<p class="muted">Loading…</p>';
    try {
      await TABS[name](sub);
    } catch (err) {
      if (err.status === 401) return (location.href = '/login');
      main.innerHTML = `<div class="msg err">${esc(err.message)}</div>`;
    }
  }

  document.querySelectorAll('.sidenav button').forEach((b) =>
    b.addEventListener('click', async () => {
      if (dirty && !(await confirmDialog('Leave without saving?', 'You have unsaved homepage changes.', 'Leave'))) return;
      dirty = false;
      location.hash = b.dataset.tab;
    }),
  );
  window.addEventListener('hashchange', route);

  async function refreshUnread() {
    try {
      const { inquiries } = await api('/api/admin/inquiries');
      const n = inquiries.filter((i) => !i.is_read).length;
      const el = document.getElementById('unread-count');
      el.textContent = n;
      el.hidden = n === 0;
    } catch {}
  }

  /* ------------------------------ Inquiries ------------------------------ */

  async function renderInquiries() {
    const { inquiries } = await api('/api/admin/inquiries');
    main.innerHTML = `
      <div class="page-title"><h1>Inquiries</h1></div>
      <p class="muted">Messages and visit requests sent from the website's contact form. Each one is also emailed to you.</p>
      <div class="table-list" id="inq-list"></div>`;
    const list = main.querySelector('#inq-list');
    if (!inquiries.length) {
      list.innerHTML = '<div class="card empty">No inquiries yet. They will show up here when parents use the contact form.</div>';
    }
    for (const q of inquiries) {
      const row = document.createElement('div');
      row.className = 'row-card' + (q.is_read ? '' : ' unread');
      const subject = q.kind === 'tour' ? 'Visit request' : 'Question';
      row.innerHTML = `
        <div>
          <h3>${esc(q.name)} <span class="badge ${q.kind === 'tour' ? 'orange' : 'blue'}">${subject}</span>
            ${q.is_read ? '' : '<span class="badge green">New</span>'}</h3>
          <div class="sub">${fmtDate(q.created_at)}${q.emailed ? '' : ' · <span title="The email could not be sent; check the Resend setup.">not emailed</span>'}</div>
        </div>
        <div class="actions">
          <a class="btn btn-sm btn-primary" href="mailto:${esc(q.email)}?subject=${encodeURIComponent("Re: your message to Mrs. Malik's Daycare")}">Reply</a>
          <button class="btn btn-sm" data-act="read">${q.is_read ? 'Mark unread' : 'Mark read'}</button>
          <button class="btn btn-sm btn-danger" data-act="delete">Delete</button>
        </div>
        <div class="kv">
          <span>Email: <b>${esc(q.email)}</b></span>
          ${q.phone ? `<span>Phone: <b>${esc(q.phone)}</b></span>` : ''}
          ${q.child_age ? `<span>Child's age: <b>${esc(q.child_age)}</b></span>` : ''}
          ${q.preferred_date ? `<span>Preferred visit: <b>${esc(q.preferred_date)}</b></span>` : ''}
        </div>
        ${q.message ? `<p class="body">${esc(q.message)}</p>` : ''}`;
      row.querySelector('[data-act=read]').onclick = async () => {
        await api(`/api/admin/inquiries/${q.id}`, { method: 'PATCH', body: { read: !q.is_read } });
        await renderInquiries();
      };
      row.querySelector('[data-act=delete]').onclick = async () => {
        if (!(await confirmDialog('Delete this inquiry?', `From ${q.name}. This can't be undone.`))) return;
        await api(`/api/admin/inquiries/${q.id}`, { method: 'DELETE' });
        toast('Inquiry deleted');
        await renderInquiries();
      };
      list.appendChild(row);
    }
    refreshUnread();
  }

  /* ------------------------------- Homepage ------------------------------ */

  function listEditor(container, items, fields, { cols, addLabel, onChange, max = 30 }) {
    const render = () => {
      container.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'list-editor';
      items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
          <div class="list-fields" style="--cols:${cols || '1fr'}">
            ${fields
              .map(
                (f) => f.type === 'photo'
                  ? `<div class="list-photo" data-photo-k="${f.key}">
                      <div class="thumb round">${item[f.key] ? `<img src="/media/${esc(item[f.key])}" alt="">` : 'No photo'}</div>
                      <div style="display:flex;gap:6px;flex-wrap:wrap">
                        <button type="button" class="btn btn-sm" data-a="photo-up">${item[f.key] ? 'Replace photo' : 'Upload photo'}</button>
                        ${item[f.key] ? '<button type="button" class="btn btn-sm btn-danger" data-a="photo-rm">Remove</button>' : ''}
                      </div>
                    </div>`
                  : `<label>${esc(f.label)}${
                  f.type === 'select'
                    ? `<select class="inline-input" data-k="${f.key}">${f.options
                        .map(([v, label]) => `<option value="${esc(v)}"${item[f.key] === v ? ' selected' : ''}>${esc(label)}</option>`)
                        .join('')}</select>`
                    : f.type === 'textarea'
                    ? `<textarea class="inline-input" data-k="${f.key}" placeholder="${esc(f.placeholder || '')}">${esc(item[f.key])}</textarea>`
                    : `<input class="inline-input" data-k="${f.key}" value="${esc(item[f.key])}" placeholder="${esc(f.placeholder || '')}">`
                }</label>`,
              )
              .join('')}
          </div>
          <div class="list-actions">
            <button type="button" class="icon-btn" data-a="up" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
            <button type="button" class="icon-btn" data-a="down" aria-label="Move down" ${i === items.length - 1 ? 'disabled' : ''}>&darr;</button>
            <button type="button" class="icon-btn" data-a="del" aria-label="Remove">&times;</button>
          </div>`;
        row.querySelectorAll('[data-photo-k]').forEach((box) => {
          const key = box.dataset.photoK;
          box.querySelector('[data-a=photo-up]').onclick = async (e) => {
            const [file] = await pickFiles({ multiple: false });
            if (!file) return;
            e.target.disabled = true;
            e.target.textContent = 'Uploading…';
            try {
              const photo = await uploadPhoto(file, { scope: 'site' });
              item[key] = photo.id;
              onChange();
            } catch (err) {
              toast(err.message, true);
            }
            render();
          };
          const rm = box.querySelector('[data-a=photo-rm]');
          if (rm)
            rm.onclick = () => {
              item[key] = '';
              onChange();
              render();
            };
        });
        row.querySelectorAll('[data-k]').forEach((input) =>
          input.addEventListener('input', () => {
            item[input.dataset.k] = input.value;
            onChange();
          }),
        );
        row.querySelector('[data-a=up]').onclick = () => {
          [items[i - 1], items[i]] = [items[i], items[i - 1]];
          onChange();
          render();
        };
        row.querySelector('[data-a=down]').onclick = () => {
          [items[i + 1], items[i]] = [items[i], items[i + 1]];
          onChange();
          render();
        };
        row.querySelector('[data-a=del]').onclick = () => {
          items.splice(i, 1);
          onChange();
          render();
        };
        wrap.appendChild(row);
      });
      container.appendChild(wrap);
      if (items.length < max) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn btn-sm';
        add.style.marginTop = '10px';
        add.textContent = '+ ' + addLabel;
        add.onclick = () => {
          items.push(Object.fromEntries(fields.map((f) => [f.key, ''])));
          onChange();
          render();
          container.querySelector('.list-row:last-child input, .list-row:last-child textarea')?.focus();
        };
        container.appendChild(add);
      }
    };
    render();
  }

  async function renderContent() {
    const { site, themes } = await api('/api/admin/content');
    dirty = false;
    main.innerHTML = `
      <div class="page-title"><h1>Homepage</h1><a class="btn btn-sm" href="/" target="_blank" rel="noopener">Preview website</a></div>

      <section class="card">
        <div class="card-head"><div><h2>Cover</h2><p class="muted">The first thing visitors see at the top of the page.</p></div></div>
        <div class="grid-2">
          <label class="field"><span>Daycare name</span><input data-key="name"></label>
          <span></span>
        </div>
        <div class="field"><span>Badges <small>(small labels above the headline, e.g. "Now enrolling", "Infant spots open"; up to 6)</small></span><div id="badges-editor"></div></div>
        <label class="field"><span>Headline</span><input data-key="heroTitle"></label>
        <label class="field"><span>Short description</span><textarea data-key="heroSubtitle" rows="2"></textarea></label>
        <div class="grid-2">
          <label class="field"><span>Ages served</span><input data-key="ages"></label>
          <label class="field"><span>License line</span><input data-key="license"></label>
        </div>
        <div class="field"><span>Cover photo <small>(a wide photo works best)</small></span><div class="photo-pick" data-photo="coverPhotoId"></div></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Theme &amp; holidays</h2>
          <p class="muted">Pick the website's colors. Holiday themes can switch on by themselves for the week before and after each holiday.</p></div></div>
        <div class="field"><span>Everyday color theme</span><div class="theme-grid" id="theme-grid"></div></div>
        <label class="check"><input type="checkbox" data-key="holidayThemes"> Automatically use a holiday theme 1 week before and after each holiday</label>
        <label class="check" style="margin-top:8px"><input type="checkbox" data-key="holidayBanner"> Show a small holiday greeting bar at the top during holidays</label>
        <label class="check" style="margin-top:8px"><input type="checkbox" data-key="holidayEffects"> Show little falling decorations on the cover during holidays (snowflakes, pumpkins, crescents, hearts…)</label>
        <div class="field" style="margin-top:14px"><span>Holidays to celebrate <small>(click Preview to see each one)</small></span><div class="holiday-list" id="holiday-list"></div></div>
        <p class="msg" id="theme-now" style="background:#f3ebe1;margin:0"></p>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Contact details & hours</h2><p class="muted">Shown in the cover, contact section, and footer.</p></div></div>
        <div class="grid-2">
          <label class="field"><span>Phone</span><input data-key="phone"></label>
          <label class="field"><span>Email</span><input data-key="email" type="email"></label>
        </div>
        <label class="field"><span>Location shown on site <small>(e.g. neighborhood or city, no street address needed)</small></span><input data-key="area"></label>
        <div class="field"><span>Hours</span><div id="hours-editor"></div></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Our story</h2><p class="muted">A short background. Leave a blank line between paragraphs.</p></div></div>
        <label class="field"><span>Section title</span><input data-key="storyTitle"></label>
        <label class="field"><span>Story</span><textarea data-key="storyBody" rows="8"></textarea></label>
        <div class="field"><span>Story photo <small>(a portrait photo works best)</small></span><div class="photo-pick" data-photo="storyPhotoId"></div></div>
        <div class="field"><span>Highlights <small>(small cards under the story, up to 6)</small></span><div id="highlights-editor"></div></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Providers</h2><p class="muted">The people who care for the children. Shown as "Our team" on the homepage. Square photos work best.</p></div></div>
        <div class="grid-2">
          <label class="field"><span>Section title</span><input data-key="providersTitle"></label>
          <label class="field"><span>Short intro <small>(optional)</small></span><input data-key="providersIntro"></label>
        </div>
        <div id="providers-editor"></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Daily schedule</h2><p class="muted">What a typical day looks like, in order.</p></div></div>
        <div id="schedule-editor"></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>FAQ</h2><p class="muted">Common questions from parents.</p></div></div>
        <div id="faq-editor"></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Contact section</h2></div></div>
        <label class="field"><span>Intro text above the contact details</span><textarea data-key="contactIntro" rows="2"></textarea></label>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Location</h2>
          <p class="muted">A map with a "Get directions" button appears under the contact form.</p></div></div>
        <label class="field"><span>Full street address <small>(leave blank to hide the map)</small></span><input data-key="address" placeholder="Street, City, VA ZIP"></label>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Reviews</h2>
          <p class="muted">Copy in favorite reviews from the daycare's Google page. Please keep them word-for-word from real parents.</p></div></div>
        <label class="check" style="margin-bottom:14px"><input type="checkbox" data-key="showReviews"> Show the Reviews section on the homepage</label>
        <label class="field"><span>Google Place ID <small>(links the Google listing: rating, "See all reviews", "Write a review")</small></span><input data-key="googlePlaceId"></label>
        <p class="msg" id="google-status" style="background:#f3ebe1">Checking Google…</p>
        <div class="grid-2">
          <label class="field"><span>Backup star rating <small>(used only if Google can't be reached)</small></span><input data-key="googleRating" inputmode="decimal"></label>
          <label class="field"><span>Backup review count</span><input data-key="googleReviewCount" inputmode="numeric"></label>
        </div>
        <div class="field"><span>Featured reviews <small>(up to 12)</small></span><div id="reviews-editor"></div></div>
      </section>

      <div class="savebar"><div class="savebar-inner">
        <span class="state" id="save-state">All changes saved</span>
        <button class="btn btn-primary" id="save-btn">Save changes</button>
      </div></div>`;

    const state = main.querySelector('#save-state');
    const markDirty = () => {
      dirty = true;
      state.textContent = 'Unsaved changes';
      state.classList.add('dirty');
    };

    main.querySelectorAll('[data-key]').forEach((input) => {
      const key = input.dataset.key;
      if (input.type === 'checkbox') input.checked = !!site[key];
      else input.value = site[key] ?? '';
      input.addEventListener(input.type === 'checkbox' ? 'change' : 'input', () => {
        site[key] = input.type === 'checkbox' ? input.checked : input.value;
        markDirty();
      });
    });

    // Live Google rating status
    const gStatus = main.querySelector('#google-status');
    const refreshGoogleStatus = async (force = false) => {
      try {
        const st = await api('/api/admin/google/status' + (force ? '?refresh=1' : ''));
        if (!st.configured) {
          gStatus.textContent = 'Live Google rating is off (no API key in Cloudflare). The backup numbers below are shown instead.';
        } else if (!st.live) {
          gStatus.textContent = "Couldn't get the rating from Google right now, so the backup numbers below are shown. It will retry in a few hours.";
        } else {
          gStatus.innerHTML = `Live from Google: <b>${esc(st.live.rating)}★ from ${esc(st.live.count)} reviews</b>
            <span class="muted">(checked ${new Date(st.live.fetchedAt).toLocaleDateString()}, updates every 30 days)</span>
            <button type="button" class="btn btn-sm" id="refresh-google" style="margin-left:6px">Refresh from Google</button>`;
          gStatus.querySelector('#refresh-google').onclick = async (e) => {
            e.target.disabled = true;
            e.target.textContent = 'Refreshing…';
            await refreshGoogleStatus(true);
            toast('Rating refreshed from Google');
          };
        }
      } catch {
        gStatus.textContent = '';
      }
    };
    refreshGoogleStatus();

    // Theme picker
    const swatch = (t) => {
      const v = { cream: '#fff8ee', peach: '#fde7d3', orange: '#e2712f', blue: '#1e4f7a', ...t.vars };
      return `<span class="swatch" style="background:${esc(v.cream)}"><i style="background:${esc(v.orange)}"></i><i style="background:${esc(v.peach)}"></i><i style="background:${esc(v.blue)}"></i></span>`;
    };
    const themeGrid = main.querySelector('#theme-grid');
    const renderThemes = () => {
      themeGrid.innerHTML = themes.base
        .map(
          (t) => `<label class="theme-option${site.theme === t.key ? ' selected' : ''}">
            <input type="radio" name="theme" value="${esc(t.key)}" ${site.theme === t.key ? 'checked' : ''}>
            ${swatch(t)}<span>${esc(t.label)}</span>
            <a href="/?theme=${esc(t.key)}" target="_blank" rel="noopener" class="small">Preview</a>
          </label>`,
        )
        .join('');
      themeGrid.querySelectorAll('input').forEach((r) =>
        r.addEventListener('change', () => {
          site.theme = r.value;
          markDirty();
          renderThemes();
        }),
      );
    };
    renderThemes();
    const holidayList = main.querySelector('#holiday-list');
    holidayList.innerHTML = themes.holidays
      .map(
        (h) => `<label class="holiday-option">
          <input type="checkbox" value="${esc(h.key)}" ${site.holidays.includes(h.key) ? 'checked' : ''}>
          ${swatch(h)}<span>${esc(h.label)}</span>
          <a href="/?theme=${esc(h.key)}" target="_blank" rel="noopener" class="small">Preview</a>
        </label>`,
      )
      .join('');
    holidayList.querySelectorAll('input').forEach((c) =>
      c.addEventListener('change', () => {
        site.holidays = [...holidayList.querySelectorAll('input:checked')].map((x) => x.value);
        markDirty();
      }),
    );
    const themeNow = main.querySelector('#theme-now');
    const showThemeNow = (t) => {
      const label = [...themes.base, ...themes.holidays].find((x) => x.key === t.active.key)?.label || t.active.key;
      themeNow.textContent = t.active.holiday
        ? `Right now the website is showing the ${label} theme (holiday). It switches back automatically afterwards.`
        : `Right now the website is showing the ${label} theme.`;
    };
    showThemeNow(themes);

    main.querySelectorAll('[data-photo]').forEach((box) => {
      const key = box.dataset.photo;
      const render = () => {
        box.innerHTML = `
          <div class="thumb">${site[key] ? `<img src="/media/${esc(site[key])}" alt="">` : 'No photo'}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-sm" data-a="up">${site[key] ? 'Replace photo' : 'Upload photo'}</button>
            ${site[key] ? '<button type="button" class="btn btn-sm btn-danger" data-a="rm">Remove</button>' : ''}
          </div>`;
        box.querySelector('[data-a=up]').onclick = async (e) => {
          const [file] = await pickFiles({ multiple: false });
          if (!file) return;
          e.target.disabled = true;
          e.target.textContent = 'Uploading…';
          try {
            const photo = await uploadPhoto(file, { scope: 'site' });
            site[key] = photo.id;
            markDirty();
          } catch (err) {
            toast(err.message, true);
          }
          render();
        };
        const rm = box.querySelector('[data-a=rm]');
        if (rm)
          rm.onclick = () => {
            site[key] = '';
            markDirty();
            render();
          };
      };
      render();
    });

    listEditor(main.querySelector('#hours-editor'), site.hours, [
      { key: 'days', label: 'Days', placeholder: 'Monday – Friday' },
      { key: 'time', label: 'Time', placeholder: '7:00 AM – 6:00 PM' },
    ], { cols: '1fr 1fr', addLabel: 'Add hours', onChange: markDirty, max: 10 });

    listEditor(main.querySelector('#highlights-editor'), site.highlights, [
      { key: 'title', label: 'Title', placeholder: 'CPR & First Aid' },
      { key: 'text', label: 'Text', placeholder: 'One short sentence' },
    ], { cols: '1fr 2fr', addLabel: 'Add highlight', onChange: markDirty, max: 6 });

    listEditor(main.querySelector('#badges-editor'), site.badges, [
      { key: 'text', label: 'Badge text', placeholder: 'Now enrolling' },
      {
        key: 'color',
        label: 'Color',
        type: 'select',
        options: [['green', 'Green'], ['orange', 'Orange'], ['blue', 'Blue'], ['pink', 'Pink'], ['yellow', 'Yellow']],
      },
    ], { cols: '2fr 1fr', addLabel: 'Add badge', onChange: markDirty, max: 6 });

    listEditor(main.querySelector('#providers-editor'), site.providers, [
      { key: 'photoId', label: 'Photo', type: 'photo' },
      { key: 'name', label: 'Name', placeholder: 'Mrs. Malik' },
      { key: 'role', label: 'Role', placeholder: 'Owner & lead provider' },
      { key: 'bio', label: 'About them', type: 'textarea', placeholder: 'Experience, certifications, what they love about working with kids…' },
    ], { cols: '1fr', addLabel: 'Add provider', onChange: markDirty, max: 12 });

    listEditor(main.querySelector('#reviews-editor'), site.featuredReviews, [
      { key: 'author', label: 'Parent name', placeholder: 'As shown on Google' },
      { key: 'rating', label: 'Stars (1-5)', placeholder: '5' },
      { key: 'when', label: 'When', placeholder: 'e.g. 2 months ago' },
      { key: 'text', label: 'Review', type: 'textarea' },
    ], { cols: '2fr 1fr 1fr', addLabel: 'Add review', onChange: markDirty, max: 12 });

    listEditor(main.querySelector('#schedule-editor'), site.schedule, [
      { key: 'time', label: 'Time', placeholder: '9:00 AM' },
      { key: 'activity', label: 'Activity', placeholder: 'Circle time' },
      { key: 'detail', label: 'Details (optional)', placeholder: 'Songs, stories…' },
    ], { cols: '110px 1fr 2fr', addLabel: 'Add schedule item', onChange: markDirty, max: 20 });

    listEditor(main.querySelector('#faq-editor'), site.faqs, [
      { key: 'q', label: 'Question' },
      { key: 'a', label: 'Answer', type: 'textarea' },
    ], { addLabel: 'Add question', onChange: markDirty, max: 30 });

    const saveBtn = main.querySelector('#save-btn');
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';
      try {
        const saved = await api('/api/admin/content', { method: 'PUT', body: { site } });
        showThemeNow(saved.themes);
        dirty = false;
        state.textContent = 'All changes saved';
        state.classList.remove('dirty');
        toast('Homepage updated');
        refreshGoogleStatus();
      } catch (err) {
        toast(err.message, true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save changes';
      }
    };
  }

  /* ------------------------------ Closed days ------------------------------ */

  const fmtDay = (iso, opts = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) =>
    new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', ...opts });
  const fmtRange = (c) => (c.end ? `${fmtDay(c.start)} – ${fmtDay(c.end)}` : fmtDay(c.start));
  const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

  async function renderClosures() {
    let { closures, suggestions } = await api('/api/admin/closures');
    const pageUrl = location.origin + '/holidays';
    main.innerHTML = `
      <div class="page-title"><h1>Closed days</h1><a class="btn btn-sm" href="/holidays" target="_blank" rel="noopener">View page</a></div>
      <p class="muted" style="margin-top:-8px">Days the daycare is closed. They're shown on a separate page (not on the homepage) that families can open from their portal, or you can send them the link.</p>

      <section class="card">
        <div class="card-head"><div><h2>Add a closed day</h2><p class="muted">Pick one day, or turn on "Several days" for a break like winter vacation.</p></div></div>
        <form id="closure-form">
          <div class="grid-2">
            <label class="field"><span>What for? <small>(e.g. Thanksgiving, Family vacation)</small></span><input name="label" maxlength="100" required></label>
            <label class="field"><span>Date</span><input name="start" type="date" required></label>
          </div>
          <label class="check" style="margin-bottom:14px"><input type="checkbox" id="multi"> Several days in a row</label>
          <div class="grid-2" id="end-row" hidden>
            <span></span>
            <label class="field"><span>Last day closed</span><input name="end" type="date"></label>
          </div>
          <label class="field"><span>Note for parents <small>(optional)</small></span><input name="note" maxlength="300" placeholder="e.g. We reopen Monday at 7:00 AM"></label>
          <button class="btn btn-primary" type="submit">Add closed day</button>
        </form>
        <div id="suggest"></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Upcoming</h2></div></div>
        <div id="upcoming"></div>
      </section>

      <section class="card" id="past-card">
        <div class="card-head"><div><h2>Past</h2><p class="muted">Already over, so hidden from the page. Kept here for your records.</p></div>
          <button class="btn btn-sm" id="clear-past" type="button">Remove all past days</button></div>
        <div id="past"></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Page text &amp; link</h2></div></div>
        <label class="field"><span>Page title</span><input id="c-title" maxlength="100"></label>
        <label class="field"><span>Intro text</span><textarea id="c-intro" rows="2" maxlength="1000"></textarea></label>
        <button class="btn btn-primary" id="c-save" type="button">Save text</button>
        <div class="field" style="margin-top:20px"><span>Link to share with families</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap"><input readonly value="${esc(pageUrl)}" style="flex:1;min-width:220px" id="c-link"><button class="btn" type="button" id="c-copy">Copy link</button></div>
        </div>
      </section>`;

    const form = main.querySelector('#closure-form');
    const multi = main.querySelector('#multi');
    const endRow = main.querySelector('#end-row');
    multi.onchange = () => {
      endRow.hidden = !multi.checked;
      form.end.required = multi.checked;
      if (!multi.checked) form.end.value = '';
    };
    form.start.onchange = () => (form.end.min = form.start.value);
    main.querySelector('#c-title').value = closures.title;
    main.querySelector('#c-intro').value = closures.intro;

    const save = async (next, msg) => {
      const res = await api('/api/admin/closures', { method: 'PUT', body: { closures: next } });
      closures = res.closures;
      suggestions = res.suggestions;
      draw();
      if (msg) toast(msg);
    };

    const row = (c, i) => `
      <div class="row-card closure-row">
        <div class="closure-when"><strong>${esc(c.name || 'Closed')}</strong><span class="muted">${esc(fmtRange(c))}</span>${c.note ? `<span class="small">${esc(c.note)}</span>` : ''}</div>
        <div class="actions">
          <button class="btn btn-sm" data-edit="${i}" type="button">Edit</button>
          <button class="btn btn-sm btn-danger" data-del="${i}" type="button">Remove</button>
        </div>
      </div>`;

    function draw() {
      const today = todayIso();
      const all = closures.days.map((c, i) => ({ c, i }));
      const up = all.filter(({ c }) => (c.end || c.start) >= today);
      const past = all.filter(({ c }) => (c.end || c.start) < today).reverse();
      main.querySelector('#upcoming').innerHTML = up.length
        ? up.map(({ c, i }) => row(c, i)).join('')
        : '<p class="muted">No upcoming closed days. Add one above.</p>';
      main.querySelector('#past-card').hidden = !past.length;
      main.querySelector('#past').innerHTML = past.map(({ c, i }) => row(c, i)).join('');
      main.querySelector('#suggest').innerHTML = suggestions.length
        ? `<div class="suggest"><p class="muted small" style="margin:18px 0 8px">Quick add common days off (click to add):</p>
            <div class="suggest-list">${suggestions
              .map((s, i) => `<button type="button" class="chip" data-sug="${i}">+ ${esc(s.name)} <span>${esc(s.end ? `${fmtDay(s.start, { month: 'short', day: 'numeric' })}–${fmtDay(s.end, { day: 'numeric' })}` : fmtDay(s.start, { month: 'short', day: 'numeric' }))}</span></button>`)
              .join('')}</div></div>`
        : '';

      main.querySelectorAll('[data-sug]').forEach((b) =>
        (b.onclick = async () => {
          b.disabled = true;
          const s = suggestions[b.dataset.sug];
          try {
            await save({ ...closures, days: [...closures.days, s] }, `${s.name} added`);
          } catch (err) {
            toast(err.message, true);
            b.disabled = false;
          }
        }),
      );
      main.querySelectorAll('[data-del]').forEach((b) =>
        (b.onclick = async () => {
          const c = closures.days[b.dataset.del];
          if (!(await confirmDialog('Remove this closed day?', `${c.name || 'Closed'} · ${fmtRange(c)}`, 'Remove'))) return;
          try {
            await save({ ...closures, days: closures.days.filter((_, i) => i !== Number(b.dataset.del)) }, 'Removed');
          } catch (err) {
            toast(err.message, true);
          }
        }),
      );
      main.querySelectorAll('[data-edit]').forEach((b) =>
        (b.onclick = () => {
          const idx = Number(b.dataset.edit);
          const c = closures.days[idx];
          modal(`<form><h2>Edit closed day</h2><p class="msg err" hidden></p>
              <label class="field"><span>What for?</span><input name="label" maxlength="100" value="${esc(c.name)}" required></label>
              <div class="grid-2">
                <label class="field"><span>First day</span><input name="start" type="date" value="${esc(c.start)}" required></label>
                <label class="field"><span>Last day <small>(blank if one day)</small></span><input name="end" type="date" value="${esc(c.end)}"></label>
              </div>
              <label class="field"><span>Note for parents</span><input name="note" maxlength="300" value="${esc(c.note)}"></label>
              <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
            </form>`, { onMount: (dlg, close) => {
            const f = dlg.querySelector('form');
            f.onsubmit = async (e) => {
              e.preventDefault();
              const err = f.querySelector('.msg');
              const d = { name: f.label.value.trim(), start: f.start.value, end: f.end.value, note: f.note.value.trim() };
              if (d.end && d.end < d.start) {
                err.textContent = 'The last day must be on or after the first day.';
                err.hidden = false;
                return;
              }
              try {
                await save({ ...closures, days: closures.days.map((x, i) => (i === idx ? d : x)) }, 'Saved');
                close();
              } catch (ex) {
                err.textContent = ex.message;
                err.hidden = false;
              }
            };
          } });
        }),
      );
    }
    draw();

    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = { name: form.label.value.trim(), start: form.start.value, end: multi.checked ? form.end.value : '', note: form.note.value.trim() };
      if (d.end && d.end < d.start) return toast('The last day must be on or after the first day.', true);
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await save({ ...closures, days: [...closures.days, d] }, `${d.name} added`);
        form.reset();
        multi.onchange();
      } catch (err) {
        toast(err.message, true);
      } finally {
        btn.disabled = false;
      }
    };
    main.querySelector('#clear-past').onclick = async () => {
      if (!(await confirmDialog('Remove all past days?', 'They are already hidden from the page. This only cleans up this list.', 'Remove'))) return;
      const today = todayIso();
      try {
        await save({ ...closures, days: closures.days.filter((c) => (c.end || c.start) >= today) }, 'Past days removed');
      } catch (err) {
        toast(err.message, true);
      }
    };
    main.querySelector('#c-save').onclick = async () => {
      try {
        await save({ ...closures, title: main.querySelector('#c-title').value, intro: main.querySelector('#c-intro').value }, 'Page text saved');
      } catch (err) {
        toast(err.message, true);
      }
    };
    main.querySelector('#c-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(pageUrl);
        toast('Link copied');
      } catch {
        main.querySelector('#c-link').select();
      }
    };
  }

  /* -------------------------------- Articles -------------------------------- */

  async function renderArticles() {
    let { articles } = await api('/api/admin/articles');
    main.innerHTML = `
      <div class="page-title"><h1>Articles</h1><a class="btn btn-sm" href="/articles" target="_blank" rel="noopener">View page</a></div>
      <p class="muted" style="margin-top:-8px">Links shown on the Articles page (linked from the homepage menu). Link to pages on this site, like the closed days page, or to articles on other websites.</p>

      <section class="card">
        <div class="card-head"><div><h2>Add a link</h2></div></div>
        <form id="article-form">
          <div class="grid-2">
            <label class="field"><span>Title</span><input name="heading" maxlength="150" required placeholder="e.g. Daycare holidays"></label>
            <label class="field"><span>Link <small>(a web address, or a page here like /holidays)</small></span><input name="link" required placeholder="https://… or /holidays"></label>
          </div>
          <label class="field"><span>Short description <small>(optional)</small></span><input name="description" maxlength="500"></label>
          <button class="btn btn-primary" type="submit">Add link</button>
        </form>
        <div id="page-sug"></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Links on the page</h2><p class="muted">Shown in this order. Use the arrows to reorder.</p></div></div>
        <div id="article-rows"></div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>Page text</h2></div></div>
        <label class="field"><span>Page title</span><input id="a-title" maxlength="100"></label>
        <label class="field"><span>Intro text</span><textarea id="a-intro" rows="2" maxlength="1000"></textarea></label>
        <button class="btn btn-primary" id="a-save" type="button">Save text</button>
      </section>`;

    const PAGES = [
      { title: 'Daycare holidays', url: '/holidays', description: 'Days the daycare is closed.' },
    ];
    const form = main.querySelector('#article-form');
    main.querySelector('#a-title').value = articles.title;
    main.querySelector('#a-intro').value = articles.intro;

    const save = async (next, msg) => {
      const res = await api('/api/admin/articles', { method: 'PUT', body: { articles: next } });
      articles = res.articles;
      draw();
      if (msg) toast(msg);
    };
    const attempt = (fn) => async (...a) => {
      try {
        await fn(...a);
      } catch (err) {
        toast(err.message, true);
      }
    };

    function draw() {
      const links = articles.links;
      main.querySelector('#article-rows').innerHTML = links.length
        ? links
            .map(
              (l, i) => `
          <div class="row-card closure-row">
            <div class="closure-when"><strong>${esc(l.title)}</strong>
              <a class="small" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.url)}</a>
              ${l.description ? `<span class="small muted">${esc(l.description)}</span>` : ''}</div>
            <div class="actions">
              <button class="icon-btn" data-up="${i}" type="button" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
              <button class="icon-btn" data-down="${i}" type="button" aria-label="Move down" ${i === links.length - 1 ? 'disabled' : ''}>&darr;</button>
              <button class="btn btn-sm" data-edit="${i}" type="button">Edit</button>
              <button class="btn btn-sm btn-danger" data-del="${i}" type="button">Remove</button>
            </div>
          </div>`,
            )
            .join('')
        : '<p class="muted">No links yet. Add one above.</p>';
      const missing = PAGES.filter((p) => !links.some((l) => l.url === p.url));
      main.querySelector('#page-sug').innerHTML = missing.length
        ? `<p class="muted small" style="margin:18px 0 8px">Quick add a page from this site:</p><div class="suggest-list">${missing
            .map((p, i) => `<button type="button" class="chip" data-page="${i}">+ ${esc(p.title)} <span>${esc(p.url)}</span></button>`)
            .join('')}</div>`
        : '';

      main.querySelectorAll('[data-page]').forEach((b) => (b.onclick = attempt(() => save({ ...articles, links: [...links, missing[b.dataset.page]] }, 'Link added'))));
      const move = (i, j) => {
        const next = [...links];
        [next[i], next[j]] = [next[j], next[i]];
        return save({ ...articles, links: next });
      };
      main.querySelectorAll('[data-up]').forEach((b) => (b.onclick = attempt(() => move(+b.dataset.up, +b.dataset.up - 1))));
      main.querySelectorAll('[data-down]').forEach((b) => (b.onclick = attempt(() => move(+b.dataset.down, +b.dataset.down + 1))));
      main.querySelectorAll('[data-del]').forEach(
        (b) =>
          (b.onclick = attempt(async () => {
            const l = links[b.dataset.del];
            if (!(await confirmDialog('Remove this link?', l.title, 'Remove'))) return;
            await save({ ...articles, links: links.filter((_, i) => i !== +b.dataset.del) }, 'Removed');
          })),
      );
      main.querySelectorAll('[data-edit]').forEach(
        (b) =>
          (b.onclick = () => {
            const idx = +b.dataset.edit;
            const l = links[idx];
            modal(
              `<form><h2>Edit link</h2><p class="msg err" hidden></p>
                <label class="field"><span>Title</span><input name="heading" maxlength="150" value="${esc(l.title)}" required></label>
                <label class="field"><span>Link</span><input name="link" value="${esc(l.url)}" required></label>
                <label class="field"><span>Short description</span><input name="description" maxlength="500" value="${esc(l.description)}"></label>
                <div class="modal-actions"><button type="button" class="btn" data-close>Cancel</button><button class="btn btn-primary">Save</button></div>
              </form>`,
              {
                onMount: (dlg, close) => {
                  const f = dlg.querySelector('form');
                  f.onsubmit = async (e) => {
                    e.preventDefault();
                    const err = f.querySelector('.msg');
                    const d = { title: f.heading.value.trim(), url: f.link.value.trim(), description: f.description.value.trim() };
                    try {
                      await saveLink(d, (list) => list.map((x, i) => (i === idx ? d : x)));
                      toast('Saved');
                      close();
                    } catch (ex) {
                      err.textContent = ex.message;
                      err.hidden = false;
                    }
                  };
                },
              },
            );
          }),
      );
    }

    async function saveLink(d, change) {
      await save({ ...articles, links: change(articles.links) });
    }

    draw();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const d = { title: form.heading.value.trim(), url: form.link.value.trim(), description: form.description.value.trim() };
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        await saveLink(d, (list) => [...list, d]);
        toast('Link added');
        form.reset();
      } catch (err) {
        toast(err.message, true);
      } finally {
        btn.disabled = false;
      }
    };
    main.querySelector('#a-save').onclick = attempt(() =>
      save({ ...articles, title: main.querySelector('#a-title').value, intro: main.querySelector('#a-intro').value }, 'Page text saved'),
    );
  }

  /* ------------------------------ Photo manager ------------------------------ */

  async function photoManager(container, { scope, familyId }) {
    const q = new URLSearchParams({ scope });
    if (familyId) q.set('familyId', familyId);
    let photos = (await api(`/api/admin/photos?${q}`)).photos;

    container.innerHTML = `
      <div class="dropzone" tabindex="0" role="button">
        <strong>Click to choose photos</strong> or drag them here<br>
        <span class="muted small">JPG or PNG. Large photos are resized automatically.</span>
      </div>
      <div class="upload-progress" hidden></div>
      <div class="photo-grid"></div>`;
    const drop = container.querySelector('.dropzone');
    const progress = container.querySelector('.upload-progress');
    const grid = container.querySelector('.photo-grid');

    const upload = async (files) => {
      files = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
      if (!files.length) return;
      progress.hidden = false;
      let done = 0;
      const failed = [];
      for (const file of files) {
        progress.textContent = `Uploading ${done + 1} of ${files.length}…`;
        try {
          const photo = await uploadPhoto(file, { scope, familyId });
          photos.unshift(photo);
        } catch (err) {
          failed.push(err.message);
        }
        done++;
      }
      progress.hidden = true;
      renderGrid();
      if (failed.length) toast(failed[0], true);
      else toast(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    };

    drop.onclick = async () => upload(await pickFiles());
    drop.onkeydown = async (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        upload(await pickFiles());
      }
    };
    drop.ondragover = (e) => {
      e.preventDefault();
      drop.classList.add('drag');
    };
    drop.ondragleave = () => drop.classList.remove('drag');
    drop.ondrop = (e) => {
      e.preventDefault();
      drop.classList.remove('drag');
      upload([...e.dataTransfer.files]);
    };

    const saveOrder = () => api('/api/admin/photos/reorder', { method: 'POST', body: { ids: photos.map((p) => p.id) } });

    function renderGrid() {
      grid.innerHTML = photos.length ? '' : '<div class="empty" style="grid-column:1/-1">No photos yet.</div>';
      photos.forEach((p, i) => {
        const tile = document.createElement('div');
        tile.className = 'photo-tile';
        tile.innerHTML = `
          <div class="img"><img src="${esc(p.url)}" alt="${esc(p.caption)}" loading="lazy"></div>
          <div class="meta">
            <input class="inline-input" placeholder="Add a caption (optional)" value="${esc(p.caption)}" maxlength="200">
            <div class="tools">
              <span>
                <button class="icon-btn" data-a="left" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>&larr;</button>
                <button class="icon-btn" data-a="right" aria-label="Move later" ${i === photos.length - 1 ? 'disabled' : ''}>&rarr;</button>
              </span>
              <button class="btn btn-sm btn-danger" data-a="del">Delete</button>
            </div>
          </div>`;
        tile.querySelector('img').onclick = () => lightbox(photos, i);
        const cap = tile.querySelector('input');
        cap.onchange = async () => {
          try {
            await api(`/api/admin/photos/${p.id}`, { method: 'PATCH', body: { caption: cap.value } });
            p.caption = cap.value;
            toast('Caption saved');
          } catch (err) {
            toast(err.message, true);
          }
        };
        const move = async (delta) => {
          const j = i + delta;
          [photos[i], photos[j]] = [photos[j], photos[i]];
          renderGrid();
          await saveOrder().catch((err) => toast(err.message, true));
        };
        tile.querySelector('[data-a=left]').onclick = () => move(-1);
        tile.querySelector('[data-a=right]').onclick = () => move(1);
        tile.querySelector('[data-a=del]').onclick = async () => {
          if (!(await confirmDialog('Delete this photo?', "It will be removed for good. This can't be undone."))) return;
          try {
            await api(`/api/admin/photos/${p.id}`, { method: 'DELETE' });
            photos = photos.filter((x) => x.id !== p.id);
            renderGrid();
            toast('Photo deleted');
          } catch (err) {
            toast(err.message, true);
          }
        };
        grid.appendChild(tile);
      });
    }
    renderGrid();
  }

  async function renderGallery() {
    main.innerHTML = `
      <div class="page-title"><h1>Gallery photos</h1></div>
      <p class="muted">These photos appear in the public Gallery section of the website. Use the arrows to change the order.
      Please only post photos where children can't be identified, or where parents have given permission.</p>
      <div class="card"><div id="pm"></div></div>`;
    await photoManager(main.querySelector('#pm'), { scope: 'gallery' });
  }

  /* -------------------------------- Families ------------------------------- */

  function showCredentials(title, email, password) {
    const text = `Website: ${location.origin}/login\nEmail: ${email}\nTemporary password: ${password}`;
    return modal(
      `<h2>${esc(title)}</h2>
       <p class="muted">Share these login details with the family. They'll be asked to choose their own password the first time they log in. This password won't be shown again.</p>
       <div class="cred">Website: ${esc(location.origin)}/login<br>Email: ${esc(email)}<br>Temporary password: <b>${esc(password)}</b></div>
       <div class="modal-actions">
         <button class="btn" id="copy-cred">Copy details</button>
         <button class="btn btn-primary" data-close="ok">Done</button>
       </div>`,
      {
        onMount: (m) => {
          m.querySelector('#copy-cred').onclick = async (e) => {
            try {
              await navigator.clipboard.writeText(text);
              e.target.textContent = 'Copied!';
            } catch {
              e.target.textContent = 'Copy failed. Select the text instead';
            }
          };
        },
      },
    );
  }

  function familyForm(f = {}) {
    return `
      <label class="field"><span>Family name <small>(e.g. "The Johnson family")</small></span><input name="name" required value="${esc(f.name || '')}" maxlength="100"></label>
      <label class="field"><span>Parent's email <small>(used to log in)</small></span><input name="email" type="email" required value="${esc(f.email || '')}" maxlength="200"></label>
      <label class="field"><span>Child / children's names <small>(optional)</small></span><input name="children" value="${esc(f.children || '')}" maxlength="300"></label>
      ${familyProfileFields(f.profile)}`;
  }

  async function renderFamilies(sub) {
    if (sub) return renderFamilyPhotos(Number(sub));
    const { families } = await api('/api/admin/families');
    main.innerHTML = `
      <div class="page-title"><h1>Families</h1><button class="btn btn-primary" id="add-family">+ Add family</button></div>
      <p class="muted">Each enrolled family gets a private login where they can see photos you upload just for them. Only you can create accounts.</p>
      <div class="table-list" id="fam-list"></div>`;
    const list = main.querySelector('#fam-list');
    if (!families.length) list.innerHTML = '<div class="card empty">No family accounts yet. Click "Add family" to create the first one.</div>';

    main.querySelector('#add-family').onclick = () =>
      modal(
        `<form id="fam-form"><h2>Add a family</h2><p class="msg err" hidden></p>${familyForm()}
         <div class="modal-actions"><button type="button" class="btn" data-close="">Cancel</button><button class="btn btn-primary" type="submit">Create account</button></div></form>`,
        {
          onMount: (m, close) => {
            m.querySelector('input').focus();
            m.querySelector('form').onsubmit = async (e) => {
              e.preventDefault();
              const msg = m.querySelector('.msg');
              try {
                const res = await api('/api/admin/families', { method: 'POST', body: formBody(e.target) });
                close();
                await showCredentials('Account created', res.email, res.tempPassword);
                renderFamilies();
              } catch (err) {
                msg.textContent = err.message;
                msg.hidden = false;
              }
            };
          },
        },
      );

    for (const f of families) {
      const row = document.createElement('div');
      row.className = 'row-card';
      row.innerHTML = `
        <div>
          <h3>${esc(f.name)} ${f.active ? '' : '<span class="badge red">Deactivated</span>'}
            ${f.mustChangePassword && f.active ? '<span class="badge">Hasn\'t logged in yet</span>' : ''}</h3>
          <div class="sub">${esc(f.email)}${f.profile.phone ? ' · ' + esc(f.profile.phone) : ''}${f.children ? ' · ' + esc(f.children) : ''}</div>
          <div class="sub">${f.photoCount} photo${f.photoCount === 1 ? '' : 's'} · Last login: ${fmtDate(f.lastLoginAt)}</div>
        </div>
        <details class="family-details">
          <summary>Contact &amp; emergency info</summary>
          <div class="kv">
            <span>Phone: <b>${esc(f.profile.phone || '—')}</b></span>
            ${f.profile.altPhone ? `<span>Other phone: <b>${esc(f.profile.altPhone)}</b></span>` : ''}
            <span>Address: <b>${esc(f.profile.address || '—')}</b></span>
            <span>Emergency: <b>${f.profile.emergencyName ? esc(f.profile.emergencyName) + (f.profile.emergencyRelationship ? ' (' + esc(f.profile.emergencyRelationship) + ')' : '') + (f.profile.emergencyPhone ? ' · ' + esc(f.profile.emergencyPhone) : '') : '—'}</b></span>
          </div>
          ${f.profile.notes ? `<p class="body" style="margin-top:8px">${esc(f.profile.notes)}</p>` : ''}
        </details>
        <div class="actions">
          <a class="btn btn-sm btn-primary" href="#families/${f.id}">Photos</a>
          <button class="btn btn-sm" data-a="edit">Edit</button>
          <button class="btn btn-sm" data-a="reset">Reset password</button>
          <button class="btn btn-sm" data-a="toggle">${f.active ? 'Deactivate' : 'Reactivate'}</button>
          <button class="btn btn-sm btn-danger" data-a="del">Delete</button>
        </div>`;
      row.querySelector('[data-a=edit]').onclick = () =>
        modal(
          `<form><h2>Edit family</h2><p class="msg err" hidden></p>${familyForm(f)}
           <div class="modal-actions"><button type="button" class="btn" data-close="">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>`,
          {
            onMount: (m, close) => {
              m.querySelector('form').onsubmit = async (e) => {
                e.preventDefault();
                try {
                  await api(`/api/admin/families/${f.id}`, { method: 'PATCH', body: formBody(e.target) });
                  close();
                  toast('Family updated');
                  renderFamilies();
                } catch (err) {
                  const msg = m.querySelector('.msg');
                  msg.textContent = err.message;
                  msg.hidden = false;
                }
              };
            },
          },
        );
      row.querySelector('[data-a=reset]').onclick = async () => {
        if (!(await confirmDialog('Reset password?', `${f.name} will get a new temporary password and be logged out.`, 'Reset password'))) return;
        try {
          const { tempPassword } = await api(`/api/admin/families/${f.id}/reset-password`, { method: 'POST' });
          await showCredentials('Password reset', f.email, tempPassword);
          renderFamilies();
        } catch (err) {
          toast(err.message, true);
        }
      };
      row.querySelector('[data-a=toggle]').onclick = async () => {
        if (f.active && !(await confirmDialog('Deactivate account?', `${f.name} won't be able to log in until you reactivate them. Their photos are kept.`, 'Deactivate'))) return;
        await api(`/api/admin/families/${f.id}`, { method: 'PATCH', body: { active: !f.active } }).catch((err) => toast(err.message, true));
        renderFamilies();
      };
      row.querySelector('[data-a=del]').onclick = async () => {
        if (!(await confirmDialog('Delete this family?', `This permanently deletes ${f.name}'s account and all ${f.photoCount} of their photos.`))) return;
        await api(`/api/admin/families/${f.id}`, { method: 'DELETE' }).catch((err) => toast(err.message, true));
        toast('Family deleted');
        renderFamilies();
      };
      list.appendChild(row);
    }
  }

  async function renderFamilyPhotos(id) {
    const { families } = await api('/api/admin/families');
    const f = families.find((x) => x.id === id);
    if (!f) {
      main.innerHTML = '<div class="msg err">Family not found.</div><a href="#families">&larr; Back to families</a>';
      return;
    }
    main.innerHTML = `
      <p><a href="#families">&larr; All families</a></p>
      <div class="page-title"><h1>${esc(f.name)}'s photos</h1></div>
      <p class="muted">Only ${esc(f.name)} (and admins) can see these photos when they log in.</p>
      <div class="card"><div id="pm"></div></div>`;
    await photoManager(main.querySelector('#pm'), { scope: 'family', familyId: id });
  }

  /* -------------------------------- Account -------------------------------- */

  async function renderAccount() {
    main.innerHTML = `
      <div class="page-title"><h1>Account &amp; admins</h1></div>
      <section class="card">
        <h2>Your profile</h2>
        <form id="profile-form" style="max-width:520px">
          <p class="msg" hidden></p>
          <div class="grid-2">
            <label class="field"><span>Name</span><input name="name" required maxlength="100" value="${esc(me.name)}"></label>
            <label class="field"><span>Mobile phone</span><input name="p.phone" type="tel" maxlength="60" value="${esc(me.profile?.phone || '')}"></label>
          </div>
          <label class="field"><span>Email <small>(used to log in)</small></span><input name="email" type="email" required maxlength="200" value="${esc(me.email)}"></label>
          <label class="check"><input type="checkbox" name="p.notifyEmail" ${me.profile?.notifyEmail !== false ? 'checked' : ''}> Email me when someone sends an inquiry from the website</label>
          <button class="btn btn-primary" type="submit" style="margin-top:14px">Save profile</button>
        </form>
      </section>
      <section class="card">
        <h2>Change your password</h2>
        <form id="pw-form" style="max-width:420px">
          <p class="msg" hidden></p>
          <label class="field"><span>Current password</span><input name="current" type="password" autocomplete="current-password" required></label>
          <label class="field"><span>New password <small>(at least 8 characters)</small></span><input name="next" type="password" autocomplete="new-password" minlength="8" required></label>
          <label class="field"><span>Confirm new password</span><input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>
          <button class="btn btn-primary" type="submit">Update password</button>
        </form>
      </section>
      <section class="card">
        <div class="card-head"><div><h2>Admins</h2><p class="muted">Admins can edit the website and manage families.</p></div>
          <button class="btn btn-sm" id="add-admin">+ Add admin</button></div>
        <div class="table-list" id="admin-list"></div>
      </section>`;

    const profileForm = main.querySelector('#profile-form');
    profileForm.onsubmit = async (e) => {
      e.preventDefault();
      const msg = profileForm.querySelector('.msg');
      msg.hidden = false;
      try {
        ({ user: me } = await api('/api/account/profile', { method: 'PATCH', body: formBody(profileForm) }));
        document.getElementById('who-name').textContent = me.name;
        msg.className = 'msg ok';
        msg.textContent = 'Profile saved.';
        renderAccountList();
      } catch (err) {
        msg.className = 'msg err';
        msg.textContent = err.message;
      }
    };

    const pwForm = main.querySelector('#pw-form');
    pwForm.onsubmit = async (e) => {
      e.preventDefault();
      const msg = pwForm.querySelector('.msg');
      const data = Object.fromEntries(new FormData(pwForm));
      msg.hidden = false;
      try {
        if (data.next !== data.confirm) throw new Error("The new passwords don't match.");
        await api('/api/account/password', { method: 'POST', body: { current: data.current, next: data.next } });
        msg.className = 'msg ok';
        msg.textContent = 'Password updated.';
        pwForm.reset();
      } catch (err) {
        msg.className = 'msg err';
        msg.textContent = err.message;
      }
    };

    async function renderAccountList() {
      const list = main.querySelector('#admin-list');
      const { admins } = await api('/api/admin/admins');
      list.innerHTML = '';
      for (const a of admins) {
        const row = document.createElement('div');
        row.className = 'row-card';
        row.innerHTML = `
          <div><h3>${esc(a.name)} ${a.id === me.id ? '<span class="badge green">You</span>' : ''}
            ${a.profile.notifyEmail ? '<span class="badge blue">Gets inquiry emails</span>' : ''}</h3>
          <div class="sub">${esc(a.email)}${a.profile.phone ? ' · ' + esc(a.profile.phone) : ''} · Last login: ${fmtDate(a.last_login_at)}</div></div>
          <div class="actions">${a.id === me.id ? '' : '<button class="btn btn-sm btn-danger">Remove</button>'}</div>`;
        const rm = row.querySelector('button');
        if (rm)
          rm.onclick = async () => {
            if (!(await confirmDialog('Remove admin?', `${a.name} will no longer be able to log in.`, 'Remove'))) return;
            await api(`/api/admin/admins/${a.id}`, { method: 'DELETE' }).catch((err) => toast(err.message, true));
            renderAccountList();
          };
        list.appendChild(row);
      }
    }
    await renderAccountList();

    main.querySelector('#add-admin').onclick = () =>
      modal(
        `<form><h2>Add an admin</h2><p class="msg err" hidden></p>
          <label class="field"><span>Name</span><input name="name" required maxlength="100"></label>
          <label class="field"><span>Email</span><input name="email" type="email" required maxlength="200"></label>
          <label class="field"><span>Mobile phone <small>(optional)</small></span><input name="p.phone" type="tel" maxlength="60"></label>
          <div class="modal-actions"><button type="button" class="btn" data-close="">Cancel</button><button class="btn btn-primary" type="submit">Create admin</button></div></form>`,
        {
          onMount: (m, close) => {
            m.querySelector('input').focus();
            m.querySelector('form').onsubmit = async (e) => {
              e.preventDefault();
              try {
                const res = await api('/api/admin/admins', { method: 'POST', body: formBody(e.target) });
                close();
                await showCredentials('Admin created', res.email, res.tempPassword);
                renderAccount();
              } catch (err) {
                const msg = m.querySelector('.msg');
                msg.textContent = err.message;
                msg.hidden = false;
              }
            };
          },
        },
      );
  }

  route();
  refreshUnread();
})();
