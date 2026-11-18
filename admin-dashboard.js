(async () => {
  const p = await AUI.shell('admin-dashboard.html', 'Admin Dashboard'); if (!p) return;
  document.getElementById('welcome').textContent = 'Welcome, ' + p.username;
  try {
    const since = new Date(); since.setDate(since.getDate() - 6); since.setHours(0, 0, 0, 0);
    const [st, week, recent] = await Promise.all([
      sb.rpc('admin_stats'),
      sb.from('download_logs').select('downloaded_at').eq('download_status', 'success').gte('downloaded_at', since.toISOString()).limit(5000),
      sb.from('download_logs').select('user_email,file_name,downloaded_at').order('downloaded_at', { ascending: false }).limit(10)]);
    if (st.error) throw new Error(st.error.message);
    const s = st.data;
    document.getElementById('stats').innerHTML = [['Registered users', s.users], ['Total files', s.files], ['Images', s.images], ['Videos', s.videos], ['PDFs', s.documents], ['Total downloads', s.downloads]]
      .map(([l, n]) => `<div class="stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');
    document.getElementById('c-types').innerHTML = AUI.bars([['Images', s.images], ['Videos', s.videos], ['PDFs', s.documents]]);
    const days = {}; for (let i = 0; i < 7; i++) { const d = new Date(since); d.setDate(d.getDate() + i); days[d.toLocaleDateString('en-CA')] = 0; }
    (week.data || []).forEach(r => { const k = new Date(r.downloaded_at).toLocaleDateString('en-CA'); if (k in days) days[k]++; });
    document.getElementById('c-days').innerHTML = AUI.bars(Object.entries(days).map(([k, v]) => [k.slice(5), v]));
    const rows = recent.data || [];
    document.getElementById('activity').innerHTML = rows.length
      ? `<table class="t"><thead><tr><th>User</th><th>File</th><th>When</th></tr></thead><tbody>${rows.map(r => `<tr><td data-label="User">${UI.esc(r.user_email || '(deleted user)')}</td><td data-label="File">${UI.esc(r.file_name || '(deleted file)')}</td><td data-label="When">${CV.fmtDate(r.downloaded_at)}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">No download activity yet.</div>';
  } catch (e) { CV.toast(e.message, 'error'); }
})();
