(async () => {
  const p = await UI.shell('files.html', 'File Library'); if (!p) return;
  const PER = 12; let page = 0, timer;
  const list = document.getElementById('list'), pager = document.getElementById('pager');
  UI.bindCards(list);
  async function load() {
    list.innerHTML = '<div class="spinner" style="grid-column:1/-1"></div>'; pager.innerHTML = '';
    const term = document.getElementById('q').value.trim().replace(/[%_\\,()]/g, ' ');
    let q = sb.from('files').select('*', { count: 'exact' });
    if (term) q = q.ilike('file_name', `%${term}%`);
    const cat = document.getElementById('cat').value; if (cat) q = q.eq('file_type', cat);
    q = q.order('created_at', { ascending: document.getElementById('sort').value === 'asc' }).range(page * PER, page * PER + PER - 1);
    const { data, count, error } = await q;
    if (error) { list.innerHTML = '<div class="empty" style="grid-column:1/-1">Could not load files.</div>'; return CV.toast(error.message, 'error'); }
    if (!data.length) { list.innerHTML = `<div class="empty" style="grid-column:1/-1">${term || cat ? 'No files match your search.' : 'No files have been shared with you yet.'}</div>`; return; }
    list.innerHTML = data.map(UI.cardHTML).join('');
    const pages = Math.ceil(count / PER);
    if (pages > 1) {
      pager.innerHTML = `<button class="btn secondary" id="prev" ${page === 0 ? 'disabled' : ''}>← Prev</button><span>Page ${page + 1} of ${pages}</span><button class="btn secondary" id="next" ${page + 1 >= pages ? 'disabled' : ''}>Next →</button>`;
      document.getElementById('prev').onclick = () => { page--; load(); };
      document.getElementById('next').onclick = () => { page++; load(); };
    }
  }
  const reset = () => { page = 0; load(); };
  document.getElementById('q').oninput = () => { clearTimeout(timer); timer = setTimeout(reset, 300); };
  document.getElementById('cat').onchange = reset; document.getElementById('sort').onchange = reset;
  load();
})();
