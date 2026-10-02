# PairTrack

**Weekly accountability partners for people who keep dropping their goals.**

PairTrack pairs a group up every week. Each pair gets a shared room where both people set goals, log progress, and check in on each other. Your goals stop being private, which makes them a lot harder to quietly abandon.

**Live demo:** [pairtrack.vercel.app](https://pairtrack.vercel.app/login)

<!-- Drag brag.mp4 into this spot while editing the README on GitHub. GitHub will upload it and paste a link that plays inline. -->

---

## How it works

1. **An admin starts the week.** Each week is a cycle (Monday to Sunday by default, or a custom range).
2. **Everyone gets a partner.** One click on *Auto-Pair Members* shuffles the group into random pairs. Admins can also pair people manually, and the app flags anyone left unpaired.
3. **Partners share a room.** Inside the room you see your goals and your partner's goals side by side, each with a status (Not started, In progress, Blocked, Done) and a progress slider.
4. **Check in by goal.** Pick a goal, set your progress, add a quick note. Check-ins show up in a shared feed, and partners can comment on each other's progress.
5. **Next week, new partner.** Archive the cycle, start a new one, and pair again.

## Features

- Email and password auth with Supabase (sign up, login, email confirmation, resend confirmation)
- Role-based access: `member` and `admin`, with an admin-only area guarded on the client
- Weekly cycles: start a new week, reset to the current week, or set a custom date range
- Random auto-pairing plus manual pairing for odd numbers or special cases
- Private pair rooms with goals, statuses, progress tracking, check-ins, and comments
- Users page where admins can promote or demote members
- Members are redirected straight to their room once they're paired

## Tech stack

| Layer | Tools |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4, Geist font |
| Forms and validation | React Hook Form, Zod |
| Backend | Supabase (Postgres, Auth, RPC functions) |
| Hosting | Vercel |

## Project structure

```
src/
  app/
    (public)/login, signup      # auth pages
    (app)/dashboard             # landing page after login, redirects to your room if paired
    (app)/room/[id]             # the shared pair room: goals, check-ins, comments
    (app)/admin                 # admin home
    (app)/admin/pairs           # weekly cycle controls and pairing
    (app)/admin/users           # role management
  components/
    AuthForm.tsx                # login and signup form
    AuthGuard.tsx               # redirects signed-out users
    AdminGate.tsx               # blocks non-admins from /admin
  lib/
    supabaseClient.ts           # Supabase client
```

## Data model

PairTrack uses these Supabase tables:

| Table | What it stores |
|---|---|
| `profiles` | User id, email, full name, role (`admin` or `member`) |
| `weekly_cycles` | Start date, end date, status (`planned`, `active`, `archived`) |
| `pairs` | One row per pair, linked to a weekly cycle |
| `pair_members` | Which users belong to which pair |
| `goals` | Pair id, owner, title, notes, status, progress |
| `goal_updates` | Check-ins: goal, user, progress, note, timestamp |
| `comments` | Messages inside a pair room |

And two Postgres functions called over RPC:

- `get_active_pair_for_user(uid)` returns the user's pair for the active week
- `get_pair_members_secure(p_pair_id, uid)` returns a pair's members only if the caller belongs to that pair

## Running it locally

**1. Clone and install**

```bash
git clone https://github.com/UsmanAli90/pairtrack.git
cd pairtrack
npm install
```

**2. Set up Supabase**

Create a Supabase project, then create the tables and functions listed above. Turn on Row Level Security so members can only read and write data for their own pair.

**3. Add environment variables**

Copy `.env.example` to `.env.local` and fill in your values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**4. Run the dev server**

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login).

**5. Make yourself an admin**

Sign up, then set your `role` to `admin` in the `profiles` table from the Supabase dashboard. After that you can promote other users from the in-app Users page.

## Roadmap

- [ ] Add the SQL schema and RLS policies to the repo so setup takes one command
- [ ] Server-side admin checks on top of the client-side gate
- [ ] Weekly summary of each pair's progress
- [ ] Email or push reminders when a partner hasn't checked in
- [ ] Pairing that avoids repeating last week's partner

## Author

Built by **Usman Ali**

- Portfolio: [usmanali.live](https://www.usmanali.live/)
- LinkedIn: [linkedin.com/in/UsmanAli90](https://www.linkedin.com/in/UsmanAli90)
- GitHub: [@UsmanAli90](https://github.com/UsmanAli90)

If you find this useful, a star on the repo helps a lot.
