# CloudVault (Phases 1-3, complete)

Secure file storage & sharing on Supabase + Netlify. Phase 1 includes the full database/RLS/storage schema,
authentication (user + admin portals), landing page, and the Snake Game.

## Setup
1. Create a project at supabase.com.
2. SQL Editor: paste and run `database/schema.sql` (tables, RLS, private `vault` bucket and storage policies).
3. Auth > Providers > Email: enabled. Auth > URL Configuration: add your Netlify URL and `http://localhost:8000`.
4. Create users in Auth > Users (Add user). A profile row with role `user` is created automatically.
5. **First admin:** in the SQL Editor run
   `update public.profiles set role='admin' where email='you@example.com';`
   (Role changes cannot be made from the browser; RLS blocks it.)
6. Local run: copy `js/env.example.js` to `js/env.js`, fill in the Project URL and anon key
   (Project Settings > API), then `python3 -m http.server 8000`.
7. Netlify: connect your GitHub repo; build command and publish directory come from `netlify.toml`.
   Add env vars `SUPABASE_URL` and `SUPABASE_ANON_KEY` under Site settings > Environment variables.
   Never use the service_role key anywhere in this project.

## Security model
- Admin status is decided only by `profiles.role` inside the database (`is_admin()`), enforced by RLS and storage policies.
- Downloads: client requests a short-lived signed URL (allowed only if storage policy passes), then calls `log_download()`.
- Remember-me is omitted; Supabase keeps the session and refreshes tokens securely.

## Troubleshooting
- "Supabase is not configured": `js/env.js` is missing or has placeholders.
- Login works but redirects back: the account is `inactive` or lacks the admin role.
- Email links go to the wrong site: fix Site URL in Auth > URL Configuration.

## User side (Phase 2)
`user-dashboard.html` (stats, recent files, profile), `files.html` (search, filter, sort, pagination, preview, download),
`user-downloads.html` (own history). Files up to 100 MB are fetched before logging, so a download is logged only after the server
delivered it; larger files stream directly and are logged when the signed link is issued. A browser cannot confirm that a file
was saved to disk, so "success" means "delivered".

## Admin side (Phase 3)
`admin-dashboard.html` (stats, charts, recent activity), `upload.html` (drag & drop, multi-file, per-file progress), `admin-files.html`
(preview, download, edit, hide, assign access, delete), `users.html` (search, add, activate/deactivate, per-user access and history),
`downloads.html` (filter by user, file, date range). Deleting a file removes the database row first, then the stored object.

### Creating users
Users are created by an admin from `users.html` ("+ Add user"), which calls the Netlify Function `netlify/functions/create-user.js`.
The function confirms the caller is an admin (via the database `is_admin()`), then uses the service-role key to create the account.
Add `SUPABASE_SERVICE_ROLE_KEY` in Netlify > Site settings > Environment variables (mark it secret; it is never sent to the browser).
Locally, run `netlify dev` instead of a plain static server so the function works (put all three variables in a local `.env`, which is git-ignored).
You can also still create users from Supabase Dashboard > Auth > Users.

### Limits
Supabase's free plan caps each upload at 50 MB (the bucket allows 500 MB; raise the global limit in Storage settings on paid plans).
Admin downloads from the file manager are not written to the download log (only user downloads are).

## Roadmap
All planned phases are complete. Ideas: CSV export of download history, bulk actions, email notifications.
