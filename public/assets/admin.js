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

  const TABS = { inquiries: renderInquiries, content: renderContent, gallery: renderGallery, families: renderFamilies, account: renderAccount };

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
    const { site } = await api('/api/admin/content');
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
        await api('/api/admin/content', { method: 'PUT', body: { site } });
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
