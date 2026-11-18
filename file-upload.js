(async () => {
  const p = await AUI.shell('upload.html', 'Upload Files'); if (!p) return;
  const TYPES = { jpg:'image', jpeg:'image', png:'image', webp:'image', gif:'image', mp4:'video', webm:'video', mov:'video', pdf:'document' };
  const MAX = 500 * 1024 * 1024; let queue = [], busy = false;
  const drop = document.getElementById('drop'), input = document.getElementById('picker'), list = document.getElementById('queue'), go = document.getElementById('go');

  function add(files) {
    for (const f of files) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (!TYPES[ext]) { CV.toast(`${f.name}: unsupported type`, 'error'); continue; }
      if (f.size > MAX) { CV.toast(`${f.name}: larger than 500 MB`, 'error'); continue; }
      queue.push({ file: f, type: TYPES[ext], name: f.name, desc: '' });
    }
    render();
  }
  function render() {
    list.innerHTML = queue.map((it, i) => `<div class="uitem" data-i="${i}">
      <div class="row"><div class="fld"><label>File name</label><input type="text" maxlength="255" data-k="name" value="${UI.esc(it.name)}"></div>
      <div class="fld"><label>Description</label><input type="text" maxlength="500" data-k="desc" value="${UI.esc(it.desc)}"></div></div>
      <div><span class="badge">${it.type}</span> <span class="fmeta">${CV.fmtSize(it.file.size)}</span> <span class="status fmeta"></span>
      ${busy ? '' : '<button class="btn secondary sm" data-rm style="float:right">Remove</button>'}</div><div class="prog"><i></i></div></div>`).join('');
    go.disabled = !queue.length || busy;
  }
  list.addEventListener('input', e => { const k = e.target.dataset.k; if (k) queue[e.target.closest('.uitem').dataset.i][k] = e.target.value; });
  list.addEventListener('click', e => { if (e.target.dataset.rm !== undefined) { queue.splice(e.target.closest('.uitem').dataset.i, 1); render(); } });
  drop.onclick = () => input.click();
  input.onchange = () => { add(input.files); input.value = ''; };
  ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => add(e.dataTransfer.files));

  // XHR (not supabase-js) so we get real upload progress.
  function xhrUpload(path, file, token, onPct) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('POST', `${window.__ENV__.SUPABASE_URL}/storage/v1/object/vault/${path.split('/').map(encodeURIComponent).join('/')}`);
      x.setRequestHeader('Authorization', 'Bearer ' + token); x.setRequestHeader('apikey', window.__ENV__.SUPABASE_ANON_KEY);
      x.setRequestHeader('x-upsert', 'false'); x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      x.upload.onprogress = e => e.lengthComputable && onPct(e.loaded / e.total * 100);
      x.onload = () => { if (x.status < 300) res(); else { let m = 'Upload failed'; try { m = JSON.parse(x.responseText).message || m; } catch {} rej(new Error(m + ` (${x.status})`)); } };
      x.onerror = () => rej(new Error('Network error')); x.send(file);
    });
  }
  go.onclick = async () => {
    if (!queue.length) return;
    if (queue.some(it => !it.name.trim())) return CV.toast('Every file needs a name', 'error');
    busy = true; render(); go.textContent = 'Uploading…';
    const isPublic = document.getElementById('public').checked; let ok = 0; const failed = [];
    const items = queue.slice();
    for (let i = 0; i < items.length; i++) {
      const it = items[i], card = list.children[i], bar = card.querySelector('.prog i'), st = card.querySelector('.status');
      try {
        const { data: { session } } = await sb.auth.getSession(); if (!session) throw new Error('Session expired, sign in again');
        const path = `${crypto.randomUUID()}/${it.file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`;
        await xhrUpload(path, it.file, session.access_token, pct => { bar.style.width = pct + '%'; st.textContent = Math.round(pct) + '%'; });
        const { error } = await sb.from('files').insert({ file_name: it.name.trim(), file_description: it.desc.trim() || null, file_type: it.type,
          mime_type: it.file.type || null, file_size: it.file.size, storage_path: path, uploaded_by: p.id, is_public: isPublic });
        if (error) { await sb.storage.from('vault').remove([path]); throw error; }
        bar.style.width = '100%'; st.textContent = '✓ Uploaded'; ok++;
      } catch (e) { st.textContent = '✗ ' + e.message; st.style.color = 'var(--danger)'; failed.push(it); }
    }
    busy = false; go.textContent = 'Upload all';
    if (ok) CV.toast(`${ok} file(s) uploaded`, 'success'); if (failed.length) CV.toast(`${failed.length} failed`, 'error');
    queue = failed; go.disabled = !failed.length;
    if (failed.length) { /* keep failed items visible with their error text */ } else setTimeout(render, 1500);
  };
})();
