# Loyalty Scan

A staff-first loyalty app for enrolling customers, issuing private QR loyalty IDs, awarding fixed visit points, redeeming rewards, and keeping an attributable audit trail.

## What works

- Demo mode with seeded customers and browser-local persistence
- Supabase email/password staff authentication with owner and staff roles
- First-owner store bootstrap at `/setup`
- Customer enrollment with QR card share, download, and print actions
- Camera scanning plus manual name, phone, or member-code lookup
- Server-enforced visit points, duplicate cooldowns, rewards, card replacement, and idempotency
- Customer directory, profiles, activity, owner dashboard, program settings, and staff management
- Row Level Security, restricted RPC functions, append-only point ledger, and audit events
- Mobile-friendly PWA shell

## Run locally

PowerShell on this machine should use the `.cmd` npm launchers:

```powershell
npm.cmd install
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). With no Supabase public configuration, the app automatically runs in demo mode.

## Connect Supabase

1. Create a Supabase project.
2. Apply every SQL file in `supabase/migrations` in filename order.
3. Copy `.env.example` to `.env.local` and fill in the project values.
4. In Supabase Authentication, create the first owner user with email/password.
5. Sign in at `/login`; the app sends an unregistered user to `/setup`, where the store and first owner membership are created.

For staff invitations in an SSR deployment, configure the Supabase **Invite user** email template to link to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/set-password
```

Add the app origins you use (local and deployed) to Supabase Auth redirect URLs. `SUPABASE_SECRET_KEY` is server-only and is required for invitations and enriched staff account details; never expose it with a `NEXT_PUBLIC_` name.

## Environment

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
SUPABASE_SECRET_KEY=sb_secret_your_server_key
```

Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` values remain supported for existing projects.

## Verify

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run test -- --run
npm.cmd run build
```

Database contract tests are in `supabase/tests/loyalty.sql` and can be run against a local Supabase stack.
