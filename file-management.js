(async () => {
  const p = await AUI.shell('admin-files.html', 'Manage Files'); if (!p) return;
  const PER = 15; let page = 0, timer; const rows = {};
  const box = document.getElementById('list'), pager = document.getElementById('pager');
  const badge = f => !f.is_available ? '<span class="badge off">Hidden</span>' : f.is_public ? '<span class="badge ok">All users</span>' : '<span class="badge warn">Assigned only</span>';

  async function load() {
    box.innerHTML = '<div class="spinner"></div>';
    let q = sb.from('files').select('*', { count: 'exact' });
    const t = AUI.like(document.getElementById('q').value); if (t) q = q.ilike('file_name', `%${t}%`);
    const c = document.getElementById('cat').value; if (c) q = q.eq('file_type', c);
    const a = document.getElementById('avail').value; if (a) q = q.eq('is_available', a === 'yes');
    const { data, count, error } = await q.order('created_at', { ascending: false }).range(page * PER, page * PER + PER - 1);
    if (error) { box.innerHTML = '<div class="empty">Could not load files.</div>'; return CV.toast(error.message, 'error'); }
    if (!data.length) { box.innerHTML = '<div class="empty">No files found.</div>'; pager.innerHTML = ''; return; }
    data.forEach(f => rows[f.id] = f);
    box.innerHTML = `<table class="t"><thead><tr><th>Name</th><th>Type</th><th>Size</th><th>Uploaded</th><th>Availability</th><th>Actions</th></tr></thead><tbody>` +
      data.map(f => `<tr data-id="${f.id}"><td data-label="Name"><b>${UI.esc(f.file_name)}</b>${f.file_description ? `<div class="fmeta">${UI.esc(f.file_description)}</div>` : ''}</td>
      <td data-label="Type">${UI.icon(f.file_type)} ${f.file_type}</td><td data-label="Size">${CV.fmtSize(f.file_size)}</td><td data-label="Uploaded">${CV.fmtDate(f.created_at)}</td><td data-label="Availability">${badge(f)}</td>
      <td data-label="Actions"><div class="actions"><button class="btn secondary sm" data-act="preview">Preview</button><button class="btn secondary sm" data-act="download">Download</button><button class="btn secondary sm" data-act="edit">Edit</button><button class="btn secondary sm" data-act="access">Access</button><button class="btn danger sm" data-act="delete">Delete</button></div></td></tr>`).join('') + '</tbody></table>';
    AUI.pager(pager, page, Math.ceil(count / PER), n => { page = n; load(); });
  }

  box.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const f = rows[b.closest('tr').dataset.id], act = b.dataset.act;
    if (act === 'preview') UI.preview(f);
    else if (act === 'download') {
      try { const url = await UI.signedUrl(f.storage_path, 120, f.file_name); const a = Object.assign(document.createElement('a'), { href: url, download: f.file_name }); document.body.append(a); a.click(); a.remove(); }
      catch (err) { CV.toast(err.message, 'error'); }
    } else if (act === 'edit') edit(f); else if (act === 'access') access(f); else if (act === 'delete') del(f);
  });

  function edit(f) {
    const m = AUI.modal('Edit file', `<div class="fld"><label>File name</label><input type="text" id="en" maxlength="255" value="${UI.esc(f.file_name)}"></div>
      <div class="fld"><label>Description</label><textarea id="ed" rows="3" maxlength="500">${UI.esc(f.file_description || '')}</textarea></div>
      <label class="fld" style="display:flex;gap:8px"><input type="checkbox" id="ea" ${f.is_available ? 'checked' : ''}> Available (uncheck to hide from all users)</label>
      <label class="fld" style="display:flex;gap:8px"><input type="checkbox" id="ep" ${f.is_public ? 'checked' : ''}> Visible to all users</label>
      <button class="btn" id="save">Save changes</button>`);
    m.body.querySelector('#save').onclick = async ev => {
      const name = m.body.querySelector('#en').value.trim(); if (!name) return CV.toast('Name is required', 'error');
      ev.target.disabled = true;
      const { data, error } = await sb.from('files').update({ file_name: name, file_description: m.body.querySelector('#ed').value.trim() || null,
        is_available: m.body.querySelector('#ea').checked, is_public: m.body.querySelector('#ep').checked }).eq('id', f.id).select();
      if (error || !data.length) { ev.target.disabled = false; return CV.toast(error ? error.message : 'Update not permitted', 'error'); }
      CV.toast('File updated', 'success'); m.close(); load();
    };
  }

  async function access(f) {
    const m = AUI.modal('Access – ' + f.file_name, '<div class="spinner"></div>');
    const [u, pm] = await Promise.all([sb.from('profiles').select('id,username,email,status').eq('role', 'user').order('username').limit(1000), sb.from('file_permissions').select('user_id').eq('file_id', f.id)]);
    if (u.error || pm.error) { m.body.innerHTML = '<p>Could not load users.</p>'; return; }
    const had = new Set(pm.data.map(r => r.user_id));
    m.body.innerHTML = (f.is_public ? '<p class="fmeta">This file is visible to <b>all users</b>; individual assignments only matter if you turn that off.</p>' : '') +
      (u.data.length ? `<div class="checks">${u.data.map(x => `<label><input type="checkbox" data-uid="${x.id}" ${had.has(x.id) ? 'checked' : ''}> ${UI.esc(x.username)} <span class="fmeta">${UI.esc(x.email)}${x.status !== 'active' ? ' (inactive)' : ''}</span></label>`).join('')}</div><br><button class="btn" id="save">Save access</button>` : '<p>No users yet.</p>');
    const s = m.body.querySelector('#save'); if (!s) return;
    s.onclick = async () => {
      s.disabled = true;
      const now = new Set([...m.body.querySelectorAll('input[data-uid]:checked')].map(i => i.dataset.uid));
      const add = [...now].filter(i => !had.has(i)).map(user_id => ({ file_id: f.id, user_id })), rem = [...had].filter(i => !now.has(i));
      let err = null;
      if (add.length) err = (await sb.from('file_permissions').insert(add)).error;
      if (!err && rem.length) err = (await sb.from('file_permissions').delete().eq('file_id', f.id).in('user_id', rem)).error;
      if (err) { s.disabled = false; return CV.toast(err.message, 'error'); }
      CV.toast('Access updated', 'success'); m.close();
    };
  }

  async function del(f) {
    if (!await AUI.confirm(`Permanently delete "${f.file_name}"? The stored file and its access rules will be removed. Download history is kept.`)) return;
    const { data, error } = await sb.from('files').delete().eq('id', f.id).select();
    if (error || !data.length) return CV.toast(error ? error.message : 'Delete not permitted', 'error');
    const r = await sb.storage.from('vault').remove([f.storage_path]);
    if (r.error) CV.toast('Record deleted, but the stored object could not be removed: ' + r.error.message, 'error'); else CV.toast('File deleted', 'success');
    load();
  }

  const reset = () => { page = 0; load(); };
  document.getElementById('q').oninput = () => { clearTimeout(timer); timer = setTimeout(reset, 300); };
  document.getElementById('cat').onchange = reset; document.getElementById('avail').onchange = reset;
  load();
})();
