# Nexa production auth setup (required)

Email confirmation, password recovery, and Google login **will redirect to localhost** or fail until these dashboard values match production.

Production domain:

```
https://www.nexaiintelligence.online
```

## 1. Supabase → Authentication → URL Configuration

**Site URL** (must NOT be localhost):

```
https://www.nexaiintelligence.online
```

**Redirect URLs** — add every line:

```
https://www.nexaiintelligence.online/auth/callback
https://www.nexaiintelligence.online/auth/callback?next=reset
https://www.nexaiintelligence.online/**
```

Optional local dev only:

```
http://localhost:3000/auth/callback
```

If Site URL stays `http://localhost:3000`, confirmation and recovery emails will open localhost even when users signed up on production.

## 2. Supabase email templates

Use the default Confirmation / Recovery templates with:

- `{{ .ConfirmationURL }}` (preferred), or
- `{{ .SiteURL }}` only after Site URL is production

Do not hardcode `http://localhost:3000` in templates.

## 3. Google provider (Supabase)

Authentication → Providers → Google:

- Enabled
- Client ID + Client Secret from Google Cloud

## 4. Google Cloud OAuth client

Authorized JavaScript origins:

```
https://www.nexaiintelligence.online
```

Authorized redirect URIs (Supabase callback — use your project ref):

```
https://<PROJECT_REF>.supabase.co/auth/v1/callback
```

Find `<PROJECT_REF>` in the Supabase project URL.

## 5. Vercel production env

Set under Production (then **Redeploy**):

```
NEXT_PUBLIC_APP_URL=https://www.nexaiintelligence.online
NEXT_PUBLIC_SITE_URL=https://www.nexaiintelligence.online
NEXT_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Plus server-only secrets (Dodo, service role if used) — never prefix those with `NEXT_PUBLIC_`.

## 6. After changing Supabase Site URL

1. Save URL configuration
2. Redeploy Vercel so `NEXT_PUBLIC_APP_URL` is live
3. Sign up with a **new** email (old confirmation links may still point at the old Site URL)
4. Click the new confirmation email — it must open `https://www.nexaiintelligence.online/...`

## 7. Billing sessions

Upgrade requires a real Supabase session (email/password or Google), not only the local Nexa profile.

If Upgrade says the session could not be verified: log out → log in on production → try Upgrade again.
