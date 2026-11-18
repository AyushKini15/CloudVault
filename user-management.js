(async () => {
  const p = await AUI.shell('users.html', 'User Management'); if (!p) return;
  const PER = 15; let page = 0, timer; const rows = {};
  const box = document.getElementById('list'), pager = document.getElementById('pager');

  async function load() {
    box.innerHTML = '<div class="spinner"></div>';
    let q = sb.from('profiles').select('*', { count: 'exact' }).eq('role', 'user');
    const t = AUI.like(document.getElementById('q').value); if (t) q = q.or(`username.ilike.%${t}%,email.ilike.%${t}%`);
    const { data, count, error } = await q.order('created_at', { ascending: false }).range(page * PER, page * PER + PER - 1);
    if (error) { box.innerHTML = '<div class="empty">Could not load users.</div>'; return CV.toast(error.message, 'error'); }
    if (!data.length) { box.innerHTML = '<div class="empty">No users found.</div>'; pager.innerHTML = ''; return; }
    const counts = await Promise.all(data.map(u => sb.from('download_logs').select('id', { count: 'exact', head: true }).eq('user_id', u.id)));
    data.forEach((u, i) => { rows[u.id] = u; u._dl = counts[i].count || 0; });
    box.innerHTML = `<table class="t"><thead><tr><th>Username</th><th>Email</th><th>Status</th><th>Joined</th><th>Downloads</th><th>Actions</th></tr></thead><tbody>` +
      data.map(u => `<tr data-id="${u.id}"><td data-label="Username"><b>${UI.esc(u.username)}</b></td><td data-label="Email">${UI.esc(u.email)}</td>
      <td data-label="Status"><span class="badge ${u.status === 'active' ? 'ok' : 'off'}">${u.status}</span></td><td data-label="Joined">${new Date(u.created_at).toLocaleDateString()}</td><td data-label="Downloads">${u._dl}</td>
      <td data-label="Actions"><div class="actions"><button class="btn secondary sm" data-act="view">Details</button><button class="btn ${u.status === 'active' ? 'danger' : ''} sm" data-act="toggle">${u.status === 'active' ? 'Deactivate' : 'Activate'}</button></div></td></tr>`).join('') + '</tbody></table>';
    AUI.pager(pager, page, Math.ceil(count / PER), n => { page = n; load(); });
  }

  box.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const u = rows[b.closest('tr').dataset.id];
    if (b.dataset.act === 'view') return details(u);
    const next = u.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive' && !await AUI.confirm(`Deactivate ${u.username}? They will lose access immediately.`, 'Deactivate')) return;
    const { data, error } = await sb.from('profiles').update({ status: next }).eq('id', u.id).select();
    if (error || !data.length) return CV.toast(error ? error.message : 'Update not permitted', 'error');
    CV.toast(`${u.username} is now ${next}`, 'success'); load();
  });

  async function details(u) {
    const m = AUI.modal('User – ' + u.username, '<div class="spinner"></div>', load);
    async function render() {
      const [pm, fl, lg, ct] = await Promise.all([
        sb.from('file_permissions').select('id,files(file_name)').eq('user_id', u.id),
        sb.from('files').select('id,file_name').order('file_name').limit(1000),
        sb.from('download_logs').select('file_name,downloaded_at,download_status').eq('user_id', u.id).order('downloaded_at', { ascending: false }).limit(20),
        sb.from('download_logs').select('id', { count: 'exact', head: true }).eq('user_id', u.id)]);
      if (pm.error || fl.error || lg.error) { m.body.innerHTML = '<p>Could not load details.</p>'; return; }
      const assigned = new Set(pm.data.map(r => r.files && r.files.file_name));
      const have = new Set((await sb.from('file_permissions').select('file_id').eq('user_id', u.id)).data?.map(r => r.file_id));
      const avail = fl.data.filter(f => !have.has(f.id));
      m.body.innerHTML = `<div class="profile"><dl><dt>Email</dt><dd>${UI.esc(u.email)}</dd><dt>Status</dt><dd>${u.status}</dd><dt>Joined</dt><dd>${CV.fmtDate(u.created_at)}</dd><dt>Downloads</dt><dd>${ct.count || 0}</dd></dl></div>
        <h4>File access (assigned)</h4>${pm.data.length ? `<div class="checks">${pm.data.map(r => `<label>${UI.esc(r.files ? r.files.file_name : '(deleted)')}<button class="btn danger sm" style="margin-left:auto" data-revoke="${r.id}">Revoke</button></label>`).join('')}</div>` : '<p class="fmeta">No individually assigned files. (Files marked “All users” are visible regardless.)</p>'}
        ${avail.length ? `<div class="actions" style="margin-top:10px"><select id="gsel" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid var(--border)">${avail.map(f => `<option value="${f.id}">${UI.esc(f.file_name)}</option>`).join('')}</select><button class="btn sm" id="grant">Grant access</button></div>` : ''}
        <h4>Recent downloads</h4>${lg.data.length ? `<table class="t"><thead><tr><th>File</th><th>When</th><th>Status</th></tr></thead><tbody>${lg.data.map(r => `<tr><td data-label="File">${UI.esc(r.file_name || '(deleted file)')}</td><td data-label="When">${CV.fmtDate(r.downloaded_at)}</td><td data-label="Status">${r.download_status}</td></tr>`).join('')}</tbody></table>` : '<p class="fmeta">No downloads yet.</p>'}`;
      m.body.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
        const { error } = await sb.from('file_permissions').delete().eq('id', b.dataset.revoke); if (error) return CV.toast(error.message, 'error'); CV.toast('Access revoked', 'success'); render();
      });
      const g = m.body.querySelector('#grant'); if (g) g.onclick = async () => {
        const { error } = await sb.from('file_permissions').insert({ file_id: m.body.querySelector('#gsel').value, user_id: u.id }); if (error) return CV.toast(error.message, 'error'); CV.toast('Access granted', 'success'); render();
      };
    }
    render();
  }

  document.getElementById('add').onclick = () => {
    const m = AUI.modal('Add user', `<div class="fld"><label>Email</label><input type="email" id="ne"></div><div class="fld"><label>Username</label><input type="text" id="nu" maxlength="30"></div>
      <div class="fld"><label>Temporary password (min 8 chars)</label><input type="password" id="np" autocomplete="new-password"></div><button class="btn" id="mk">Create user</button>`);
    m.body.querySelector('#mk').onclick = async ev => {
      ev.target.disabled = true;
      try {
        const { data: { session } } = await sb.auth.getSession();
        const r = await fetch('/.netlify/functions/create-user', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
          body: JSON.stringify({ email: m.body.querySelector('#ne').value, username: m.body.querySelector('#nu').value, password: m.body.querySelector('#np').value }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not create user');
        CV.toast('User created', 'success'); m.close(); load();
      } catch (e) { CV.toast(e.message, 'error'); ev.target.disabled = false; }
    };
  };
  document.getElementById('q').oninput = () => { clearTimeout(timer); timer = setTimeout(() => { page = 0; load(); }, 300); };
  load();
})();
