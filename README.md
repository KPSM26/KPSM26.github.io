# DayDock

DayDock is a schedule-first planner with time blocking, auto-planning, and task management. It now supports:

- installable `PWA` behavior for iPhone and desktop
- optional `Supabase` cloud sync for sharing the same schedule across devices
- offline-first local storage so the app still works without a network

## Run locally

```bash
npm install
npm run dev
```

## PWA setup

The app already includes a web manifest and service worker. To use it like an app on iPhone:

1. Deploy it on `HTTPS`
2. Open the site in `Safari`
3. Use `Share > Add to Home Screen`

## Supabase sync setup

1. Create a Supabase project.
2. In the Supabase SQL editor, run [supabase/schema.sql](/Users/kunwar/Documents/CODEX%20PROJECTS/DAYDOCK/supabase/schema.sql:1).
3. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - optional `VITE_DAYDOCK_SYNC_CODE`
4. Start the app or rebuild it after changing env vars.
5. In DayDock Settings:
   - turn on `Sync with Supabase`
   - paste the same `Supabase URL`, `anon key`, and `shared sync code` on every device

## Notes

- The included Supabase policy is intentionally simple for personal use and easy setup.
- If you want stronger privacy later, the next step would be adding Supabase Auth and locking rows to signed-in users.
