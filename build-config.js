// Netlify build step: writes js/env.js from environment variables.
// The anon/publishable key is designed to be public; security comes from RLS.
const fs = require('fs');
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY'); process.exit(1); }
fs.writeFileSync('js/env.js', `window.__ENV__ = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key })};\n`);
console.log('js/env.js generated');
