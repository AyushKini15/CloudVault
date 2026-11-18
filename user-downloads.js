(async () => {
  const p = await UI.shell('user-downloads.html', 'Download History'); if (!p) return;
  const PER = 15; let page = 0;
  const box = document.getElementById('hist'), pager = document.getElementById('pager');
  async function load() {
    box.innerHTML = '<div class="spinner"></div>';
    const { data, count, error } = await sb.from('download_logs').select('*', { count: 'exact' })
      .eq('user_id', p.id).order('downloaded_at', { ascending: false }).range(page * PER, page * PER + PER - 1);
    if (error) { box.innerHTML = '<div class="empty">Could not load history.</div>'; return CV.toast(error.message, 'error'); }
    document.querySelector('#total .n').textContent = count ?? 0;
    if (!data.length) { box.innerHTML = '<div class="empty">You haven\'t downloaded any files yet.</div>'; pager.innerHTML = ''; return; }
    box.innerHTML = `<table class="t"><thead><tr><th>File</th><th>Date &amp; time</th><th>Status</th></tr></thead><tbody>` +
      data.map(r => `<tr><td data-label="File">${UI.esc(r.file_name || '(deleted file)')}</td><td data-label="Date">${CV.fmtDate(r.downloaded_at)}</td><td data-label="Status">${UI.esc(r.download_status)}</td></tr>`).join('') + '</tbody></table>';
    const pages = Math.ceil(count / PER);
    pager.innerHTML = pages > 1 ? `<button class="btn secondary" id="prev" ${page === 0 ? 'disabled' : ''}>← Prev</button><span>Page ${page + 1} of ${pages}</span><button class="btn secondary" id="next" ${page + 1 >= pages ? 'disabled' : ''}>Next →</button>` : '';
    if (pages > 1) { document.getElementById('prev').onclick = () => { page--; load(); }; document.getElementById('next').onclick = () => { page++; load(); }; }
  }
  load();
})();
