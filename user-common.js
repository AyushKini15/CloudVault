const UI = {
  files: {},
  esc(s) { const d = document.createElement('div'); d.textContent = s ?? ''; return d.innerHTML; },
  icon: t => ({ image: '🖼️', video: '🎬', document: '📄' }[t] || '📁'),
  // Builds sidebar/topbar, moves <template id="page"> into <main>.
  async shell(active, title) {
    const profile = await CV.requireAuth('user');
    if (!profile) return null;
    const nav = [['user-dashboard.html','🏠','Dashboard'],['files.html','📁','File Library'],['user-downloads.html','📥','Download History'],['snake-game.html','🎮','Mini Games']];
    document.getElementById('app').innerHTML = `
      <div class="layout"><aside class="sidebar" id="sidebar"><a class="brand" href="user-dashboard.html">Cloud<span>Vault</span></a>
      ${nav.map(n => `<a class="link ${n[0]===active?'active':''}" href="${n[0]}">${n[1]} ${n[2]}</a>`).join('')}
      <div class="spacer"></div>${profile.role==='admin'?'<a class="link" href="admin-dashboard.html">🛠 Admin</a>':''}
      <button class="link" id="logout">🚪 Logout</button></aside><div class="overlay" id="overlay"></div>
      <div class="main"><header class="topbar"><button id="menu" aria-label="Menu">☰</button><h2>${UI.esc(title)}</h2></header><main id="content"></main></div></div>`;
    document.getElementById('content').append(document.getElementById('page').content);
    const sb_ = document.getElementById('sidebar'), ov = document.getElementById('overlay');
    const tog = () => { sb_.classList.toggle('open'); ov.classList.toggle('show'); };
    document.getElementById('menu').onclick = tog; ov.onclick = tog;
    document.getElementById('logout').onclick = () => CV.logout();
    return profile;
  },
  async signedUrl(path, secs, download) {
    const { data, error } = await sb.storage.from('vault').createSignedUrl(path, secs, download ? { download } : undefined);
    if (error) throw new Error('Not authorized or file unavailable');
    return data.signedUrl;
  },
  cardHTML(f) {
    UI.files[f.id] = f;
    return `<div class="fcard" data-id="${f.id}"><div class="fthumb">${UI.icon(f.file_type)}</div>
      <div class="fbody"><div class="fname">${UI.esc(f.file_name)}</div>
      <div class="fmeta">${CV.fmtSize(f.file_size)} · ${new Date(f.created_at).toLocaleDateString()}</div>
      ${f.file_description ? `<div class="fmeta">${UI.esc(f.file_description)}</div>` : ''}</div>
      <div class="factions"><button class="btn secondary" data-act="preview">Preview</button><button class="btn" data-act="download">Download</button></div></div>`;
  },
  bindCards(root) {
    root.addEventListener('click', e => {
      const b = e.target.closest('button[data-act]'); if (!b) return;
      const f = UI.files[b.closest('.fcard').dataset.id];
      if (b.dataset.act === 'preview') UI.preview(f); else UI.download(f, b);
    });
  },
  async preview(f) {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="modal-box"><div class="modal-head"><b>${UI.esc(f.file_name)}</b><button class="btn secondary" id="mclose">Close</button></div><div class="modal-body"><div class="spinner"></div></div></div>`;
    document.body.append(m);
    const close = () => m.remove();
    m.querySelector('#mclose').onclick = close; m.onclick = e => { if (e.target === m) close(); };
    const body = m.querySelector('.modal-body');
    try {
      const url = await UI.signedUrl(f.storage_path, 300);
      if (f.file_type === 'image') body.innerHTML = `<img alt="" src="${url}">`;
      else if (f.file_type === 'video') body.innerHTML = `<video controls playsinline src="${url}">Your browser can't play this video. Try downloading it.</video>`;
      else body.innerHTML = `<iframe title="PDF preview" src="${url}"></iframe><p><a href="${url}" target="_blank" rel="noopener">Open PDF in a new tab</a></p>`;
    } catch (err) { body.innerHTML = `<p>${UI.esc(err.message)}</p>`; }
  },
  // Files up to 100 MB are fetched first, so a download is logged only after the server actually delivered it.
  async download(f, btn) {
    const label = btn.textContent; btn.disabled = true; btn.textContent = '…';
    try {
      const url = await UI.signedUrl(f.storage_path, 120, f.file_name);
      if (f.file_size <= 100 * 1024 * 1024) {
        const res = await fetch(url); if (!res.ok) throw new Error('Download failed (' + res.status + ')');
        const blobUrl = URL.createObjectURL(await res.blob());
        const a = Object.assign(document.createElement('a'), { href: blobUrl, download: f.file_name });
        document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      } else { location.href = url; }  // large files stream directly; logged when the link is issued
      const { error } = await sb.rpc('log_download', { p_file_id: f.id });
      if (error) console.error(error);
      CV.toast('Download started', 'success');
    } catch (err) { CV.toast(err.message, 'error'); }
    btn.disabled = false; btn.textContent = label;
  }
};
