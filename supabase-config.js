// Requires js/env.js (generated on Netlify, or copied from env.example.js locally).
(function () {
  const env = window.__ENV__;
  if (!env || !env.SUPABASE_URL || env.SUPABASE_URL.includes('YOUR-PROJECT')) {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.insertAdjacentHTML('afterbegin',
        '<div style="background:#b91c1c;color:#fff;padding:12px;text-align:center">Supabase is not configured. See README.</div>');
    });
    return;
  }
  window.sb = window.supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
