// Creates a user account. Needs the service-role key, so it lives server-side only.
// Env vars (Netlify, never in frontend): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
const json = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const { SUPABASE_URL: URL_, SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE } = process.env;
  if (!URL_ || !ANON || !SERVICE) return json(500, { error: 'Server is not configured' });

  // 1. Verify the caller is an active admin (checked by the database, using the caller's own token).
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Not signed in' });
  const chk = await fetch(`${URL_}/rest/v1/rpc/is_admin`, { method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
  if (!chk.ok || (await chk.json()) !== true) return json(403, { error: 'Admins only' });

  // 2. Validate input.
  let b; try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid request' }); }
  const email = String(b.email || '').trim().toLowerCase(), username = String(b.username || '').trim(), password = String(b.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'Invalid email address' });
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) return json(400, { error: 'Username: 3-30 letters, numbers, . _ -' });
  if (password.length < 8) return json(400, { error: 'Password must be at least 8 characters' });

  const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };
  const dup = await fetch(`${URL_}/rest/v1/profiles?select=id&username=ilike.${encodeURIComponent(username)}`, { headers: H });
  if (dup.ok && (await dup.json()).length) return json(400, { error: 'That username is already taken' });

  // 3. Create the auth user; the database trigger creates the profile with role "user".
  const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: 'POST', headers: H,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return json(400, { error: j.msg || j.message || 'Could not create user' });
  return json(200, { id: j.id });
};
