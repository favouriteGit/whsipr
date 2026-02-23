# 🤫 Whispr — Setup Guide

Anonymous group confession boards. No gatekeeping. No selective screenshots.

---

## What you need before starting

- [ ] **Node.js** (v18 or newer) → download at https://nodejs.org
- [ ] **A Supabase account** (free) → https://supabase.com
- [ ] **A Vercel account** (free) → https://vercel.com
- [ ] **Git** installed on your computer

---

## Step 1 — Set up the database (Supabase)

1. Go to https://supabase.com and sign in
2. Click **"New project"**
3. Give it a name (e.g. `whispr`), choose a region close to you, set a password
4. Wait ~1 minute for it to spin up
5. In the left sidebar, click **"SQL Editor"**
6. Click **"New query"**
7. Open the file `supabase/schema.sql` from this project folder
8. Copy ALL of its contents and paste into the SQL editor
9. Click **"Run"** (green button)
10. You should see "Success. No rows returned"

---

## Step 2 — Get your Supabase keys

1. In Supabase, go to **Settings** (gear icon) → **API**
2. Copy the **Project URL** (looks like `https://abcdefgh.supabase.co`)
3. Copy the **anon / public key** (long string starting with `eyJ...`)

---

## Step 3 — Configure the project

1. In the project folder, find the file `.env.example`
2. Make a copy of it named exactly `.env.local`
3. Open `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## Step 4 — Run it locally

Open your terminal in the project folder and run:

```bash
npm install
npm run dev
```

Then open http://localhost:3000 in your browser. 🎉

---

## Step 5 — Deploy to the internet (Vercel)

So others can actually use it:

1. Push this project to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   # Create a new repo on github.com, then:
   git remote add origin https://github.com/YOUR_USERNAME/whispr.git
   git push -u origin main
   ```

2. Go to https://vercel.com → **"Add New Project"**
3. Import your GitHub repo
4. Before clicking Deploy, go to **"Environment Variables"** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
5. Click **Deploy**

Your app will be live at a URL like `https://whispr-yourname.vercel.app` 🚀

---

## How it works

```
User visits /board/W3IR-X9PK
       ↓
Next.js looks up board by code in Supabase
       ↓
Fetches all confessions + reaction counts
       ↓
Subscribes to realtime changes via WebSocket
       ↓
Any new confession or reaction instantly appears
for every member on the board — no refresh needed
```

**Anonymity model:**
- No accounts, no emails, no passwords
- Each browser gets a random session ID stored in localStorage
- This ID is only used to track "did this device already react" — it cannot identify a person
- Confessions are stored with a random `anon_seed` for generating the avatar — not linked to any session

---

## File structure

```
whispr/
├── app/
│   ├── page.tsx              ← Landing page (create / join)
│   ├── board/[code]/page.tsx ← The confession board
│   ├── globals.css           ← Styles
│   └── layout.tsx            ← Root layout
├── lib/
│   └── supabase.ts           ← All database logic + types
├── supabase/
│   └── schema.sql            ← Run this in Supabase SQL editor
├── .env.example              ← Copy to .env.local and fill in
└── package.json
```

---

## Troubleshooting

**"Board not found" error after creating:**
→ Make sure you ran the full `schema.sql` in Supabase

**Confessions not appearing live:**
→ In Supabase, go to Database → Replication → make sure `confessions` and `reactions` tables are enabled for realtime

**Environment variables not working:**
→ Make sure the file is named `.env.local` (not `.env` or `.env.example`)
→ Restart the dev server after changing env files

---

Built with Next.js 14, Supabase, TypeScript, and Tailwind CSS.
