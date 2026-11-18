(async () => {
  const p = await UI.shell('user-dashboard.html', 'Dashboard'); if (!p) return;
  document.getElementById('welcome').textContent = 'Welcome, ' + p.username + ' 👋';
  document.getElementById('profile').innerHTML = [['Username', p.username], ['Email', p.email], ['Role', p.role], ['Member since', new Date(p.created_at).toLocaleDateString()]]
    .map(([k, v]) => `<dt>${k}</dt><dd>${UI.esc(v)}</dd>`).join('');
  // RLS already limits these queries to files this user may access.
  const count = t => { let q = sb.from('files').select('id', { count: 'exact', head: true }); if (t) q = q.eq('file_type', t); return q; };
  try {
    const [a, i, v, d, rec] = await Promise.all([count(), count('image'), count('video'), count('document'),
      sb.from('files').select('*').order('created_at', { ascending: false }).limit(6)]);
    if (a.error || rec.error) throw new Error('Could not load files');
    document.getElementById('stats').innerHTML = [['Available files', a.count], ['Images', i.count], ['Videos', v.count], ['PDFs', d.count]]
      .map(([l, n]) => `<div class="stat"><div class="n">${n ?? 0}</div><div class="l">${l}</div></div>`).join('');
    const box = document.getElementById('recent');
    box.innerHTML = rec.data.length ? rec.data.map(UI.cardHTML).join('') : '<div class="empty" style="grid-column:1/-1">No files have been shared with you yet.</div>';
    UI.bindCards(box);
  } catch (e) { CV.toast(e.message, 'error'); }
})();
