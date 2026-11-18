(async () => {
  const p = await AUI.shell('downloads.html', 'Download History'); if (!p) return;
  const PER = 20; let page = 0, timer;
  const box = document.getElementById('list'), pager = document.getElementById('pager'), $ = id => document.getElementById(id);
  const us = await sb.from('profiles').select('id,username').eq('role', 'user').order('username').limit(1000);
  (us.data || []).forEach(u => $('user').insertAdjacentHTML('beforeend', `<option value="${u.id}">${UI.esc(u.username)}</option>`));

  async function load() {
    box.innerHTML = '<div class="spinner"></div>';
    let ids = null; const t = AUI.like($('uq').value);
    if (t) {
      const r = await sb.from('profiles').select('id').or(`username.ilike.%${t}%,email.ilike.%${t}%`).limit(200);
      ids = (r.data || []).map(x => x.id);
      if (!ids.length) { $('total').textContent = 0; box.innerHTML = '<div class="empty">No matching activity.</div>'; pager.innerHTML = ''; return; }
    }
    let q = sb.from('download_logs').select('*, profiles(username)', { count: 'exact' });
    if (ids) q = q.in('user_id', ids);
    if ($('user').value) q = q.eq('user_id', $('user').value);
    const ft = AUI.like($('fq').value); if (ft) q = q.ilike('file_name', `%${ft}%`);
    if ($('from').value) q = q.gte('downloaded_at', new Date($('from').value + 'T00:00:00').toISOString());
    if ($('to').value) q = q.lte('downloaded_at', new Date($('to').value + 'T23:59:59.999').toISOString());
    const { data, count, error } = await q.order('downloaded_at', { ascending: false }).range(page * PER, page * PER + PER - 1);
    if (error) { box.innerHTML = '<div class="empty">Could not load history.</div>'; return CV.toast(error.message, 'error'); }
    $('total').textContent = count ?? 0;
    if (!data.length) { box.innerHTML = '<div class="empty">No download activity found.</div>'; pager.innerHTML = ''; return; }
    box.innerHTML = `<table class="t"><thead><tr><th>User</th><th>Email</th><th>File</th><th>Date</th><th>Time</th><th>Status</th></tr></thead><tbody>` +
      data.map(r => { const d = new Date(r.downloaded_at); return `<tr><td data-label="User">${UI.esc(r.profiles ? r.profiles.username : '(deleted user)')}</td><td data-label="Email">${UI.esc(r.user_email || '')}</td><td data-label="File">${UI.esc(r.file_name || '(deleted file)')}</td><td data-label="Date">${d.toLocaleDateString()}</td><td data-label="Time">${d.toLocaleTimeString()}</td><td data-label="Status">${UI.esc(r.download_status)}</td></tr>`; }).join('') + '</tbody></table>';
    AUI.pager(pager, page, Math.ceil(count / PER), n => { page = n; load(); });
  }
  const reset = () => { page = 0; load(); };
  ['uq', 'fq'].forEach(id => $(id).oninput = () => { clearTimeout(timer); timer = setTimeout(reset, 300); });
  ['user', 'from', 'to'].forEach(id => $(id).onchange = reset);
  $('clear').onclick = () => { ['uq', 'fq', 'user', 'from', 'to'].forEach(id => $(id).value = ''); reset(); };
  load();
})();
