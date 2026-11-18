// Shared auth + UI helpers. Real authorization is enforced by Supabase RLS;
// the checks here only control navigation and UX.
const CV = {
  toast(msg, type = 'info') {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  },
  async getProfile() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    return error ? null : data;
  },
  // Call at top of protected pages. role: 'user' | 'admin'
  async requireAuth(role) {
    const p = await CV.getProfile();
    const login = role === 'admin' ? 'admin-login.html' : 'user-login.html';
    if (!p || p.status !== 'active') { await sb.auth.signOut(); location.replace(login); return null; }
    if (role === 'admin' && p.role !== 'admin') { location.replace('user-dashboard.html'); return null; }
    return p;
  },
  async logout() { await sb.auth.signOut(); location.replace('index.html'); },
  async signIn(identifier, password, portal) {
    let email = identifier.trim();
    if (!email.includes('@')) {
      const { data } = await sb.rpc('email_for_username', { p_username: email });
      if (!data) throw new Error('Invalid credentials');
      email = data;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Invalid credentials');
    const p = await CV.getProfile();
    if (!p) { await sb.auth.signOut(); throw new Error('Profile not found'); }
    if (p.status !== 'active') { await sb.auth.signOut(); throw new Error('This account has been deactivated'); }
    if (portal === 'admin' && p.role !== 'admin') { await sb.auth.signOut(); throw new Error('Not an admin account'); }
    return p;
  },
  async resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/user-login.html' });
    if (error) throw error;
  },
  fmtSize(b) { if (!b) return '0 B'; const u = ['B','KB','MB','GB']; const i = Math.min(Math.floor(Math.log(b)/Math.log(1024)), 3); return (b/Math.pow(1024,i)).toFixed(i?1:0)+' '+u[i]; },
  fmtDate(d) { return new Date(d).toLocaleString(); }
};

// Login form wiring (used by both login pages)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) return;
  const portal = form.dataset.portal;
  const pw = document.getElementById('password');
  document.getElementById('toggle-pw').addEventListener('click', e => {
    pw.type = pw.type === 'password' ? 'text' : 'password';
    e.target.textContent = pw.type === 'password' ? 'Show' : 'Hide';
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const id = document.getElementById('identifier').value;
    if (!id || !pw.value) return CV.toast('Please fill in all fields', 'error');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      await CV.signIn(id, pw.value, portal);
      location.replace(portal === 'admin' ? 'admin-dashboard.html' : 'user-dashboard.html');
    } catch (err) { CV.toast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Sign in'; }
  });
  const fp = document.getElementById('forgot');
  if (fp) fp.addEventListener('click', async e => {
    e.preventDefault();
    const email = prompt('Enter your account email:');
    if (!email) return;
    try { await CV.resetPassword(email.trim()); CV.toast('If that email exists, a reset link was sent.', 'success'); }
    catch (err) { CV.toast(err.message, 'error'); }
  });
});
