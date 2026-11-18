const AUI = {
  async shell(active, title) {
    const profile = await CV.requireAuth('admin'); if (!profile) return null;
    const nav = [['admin-dashboard.html','📊','Dashboard'],['upload.html','⬆️','Upload Files'],['admin-files.html','📁','Manage Files'],['users.html','👥','Users'],['downloads.html','📥','Download History'],['snake-game.html','🎮','Mini Games']];
    document.getElementById('app').innerHTML = `
      <div class="layout"><aside class="sidebar" id="sidebar"><a class="brand" href="admin-dashboard.html">Cloud<span>Vault</span> Admin</a>
      ${nav.map(n => `<a class="link ${n[0]===active?'active':''}" href="${n[0]}">${n[1]} ${n[2]}</a>`).join('')}
      <div class="spacer"></div><a class="link" href="user-dashboard.html">👤 User view</a><button class="link" id="logout">🚪 Logout</button></aside><div class="overlay" id="overlay"></div>
      <div class="main"><header class="topbar"><button id="menu" aria-label="Menu">☰</button><h2>${UI.esc(title)}</h2></header><main id="content"></main></div></div>`;
    document.getElementById('content').append(document.getElementById('page').content);
    const s = document.getElementById('sidebar'), o = document.getElementById('overlay');
    const tog = () => { s.classList.toggle('open'); o.classList.toggle('show'); };
    document.getElementById('menu').onclick = tog; o.onclick = tog;
    document.getElementById('logout').onclick = () => CV.logout();
    return profile;
  },
  modal(title, html, onClose) {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="modal-box" style="max-width:680px"><div class="modal-head"><b>${UI.esc(title)}</b><button class="btn secondary sm" data-close>Close</button></div><div class="modal-body" style="text-align:left">${html}</div></div>`;
    document.body.append(m);
    const close = () => { m.remove(); onClose && onClose(); };
    m.querySelector('[data-close]').onclick = close; m.addEventListener('mousedown', e => { if (e.target === m) close(); });
    return { el: m, body: m.querySelector('.modal-body'), close };
  },
  confirm(msg, label = 'Delete') {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      const m = AUI.modal('Please confirm', `<p>${UI.esc(msg)}</p><div class="actions" style="justify-content:flex-end"><button class="btn secondary" id="no">Cancel</button><button class="btn danger" id="yes">${UI.esc(label)}</button></div>`, () => fin(false));
      m.body.querySelector('#no').onclick = () => { m.close(); };
      m.body.querySelector('#yes').onclick = () => { fin(true); m.el.remove(); };
    });
  },
  like: s => (s || '').trim().replace(/[%_\\,()]/g, ' '),
  pager(el, page, pages, go) {
    if (pages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML = `<button class="btn secondary sm" id="pp" ${page===0?'disabled':''}>← Prev</button><span>Page ${page+1} of ${pages}</span><button class="btn secondary sm" id="pn" ${page+1>=pages?'disabled':''}>Next →</button>`;
    el.querySelector('#pp').onclick = () => go(page - 1); el.querySelector('#pn').onclick = () => go(page + 1);
  },
  bars(items) {
    const max = Math.max(1, ...items.map(i => i[1]));
    return items.map(([l, v]) => `<div class="barrow"><span class="lbl">${UI.esc(l)}</span><div class="track"><div class="fill" style="width:${v/max*100}%"></div></div><span class="val">${v}</span></div>`).join('');
  }
};
