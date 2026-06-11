# RCNK Tracker — Simple Setup Guide

A private tracker for **Rukmini** and **Nikhil**. No App Store, no coding. Everything below is done by clicking in your web browser — no "terminal", no developer tools.

**You'll need:** about 20 minutes, and to create 2 free accounts (Supabase + Vercel). **Cost: ₹0. No credit card.**

Keep this guide open on your computer. Do the steps in order. Where it says *copy this*, copy the exact value.

---

## Before you start
Unzip the folder I gave you (`rcnk-tracker.zip`) somewhere you can find it, like your Desktop. You should see files like `index.html`, `config.js`, and folders called `api` and `icons`. You'll upload this whole folder later.

---

## PART 1 — The database (Supabase)
*This is the shared notebook both phones read and write to.*

1. Go to **supabase.com** and click **Start your project** → sign up (Google or email).
2. Click **New project**. Give it any name (e.g. "rcnk"). Set a database password (save it somewhere, you won't need it daily). Choose region **South Asia (Mumbai)**. Click **Create**. Wait ~2 minutes.
3. On the left, click **SQL Editor** → **New query**.
4. Open the file `supabase-schema.sql` from your folder (open it with TextEdit / Notepad), select all the text, copy it, paste into that box, and click **Run** (bottom right). You should see **Success**.
5. On the left, click the **gear icon (Project Settings)** → **API**.
6. You'll see three things you need. Keep this page open — copy each into a notes app for a minute:
   - **Project URL** — looks like `https://xxxxx.supabase.co`
   - **anon public** key — a very long string
   - **service_role** key — a different long string (this one is secret)

*(If your screen shows "Publishable" and "Secret" keys instead of anon/service_role: Publishable = anon, Secret = service_role.)*

---

## PART 2 — Put the app online (GitHub + Vercel)

### Step A — Upload the code to GitHub
*GitHub just stores the files so Vercel can pick them up.*

1. Go to **github.com** → sign up (free) if you don't have an account.
2. Click the **+** at the top right → **New repository**.
3. Name it `rcnk-tracker`. Leave everything else as is. Click **Create repository**.
4. On the next page, click the link **uploading an existing file**.
5. Open your unzipped `rcnk-tracker` folder, select **everything inside it** (all files + the `api` and `icons` folders), and **drag it all** into the upload box. Wait for it to finish listing the files.
6. Click **Commit changes**.

### Step B — Fill in your 3 details
1. In your GitHub repo, click the file **`config.js`**.
2. Click the **pencil icon** (top right of the file) to edit.
3. Replace the three placeholder values with yours from Part 1:
   - `SUPABASE_URL` → your **Project URL**
   - `SUPABASE_ANON_KEY` → your **anon public** key
   - `SHARED_PASSWORD` → a password you'll both type to log in (pick something simple you'll remember)
4. Leave the `VAPID_PUBLIC_KEY` line untouched.
5. Click **Commit changes**.

### Step C — Deploy on Vercel
1. Go to **vercel.com** → **Sign Up** → choose **Continue with GitHub** → Authorize.
2. Click **Add New… → Project**. Find `rcnk-tracker` in the list → **Import**.
3. Before clicking Deploy, open the **Environment Variables** section and add these **five**, one at a time (Name on the left, Value on the right):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL (same as in config.js) |
   | `SUPABASE_SERVICE_ROLE_KEY` | your **service_role** secret key |
   | `VAPID_PUBLIC_KEY` | `BKHYgVn4xySqyzdUABRydF6neASTeCUhIOsB1TN6tPdcvi2dpLTt2OP3rejXOh9DjOko2HU4qllM5eDf5yUoGUQ` |
   | `VAPID_PRIVATE_KEY` | `w3QW9aSgtFQou0sab5qzmjzycqkBhmwfacWHRHGdOoo` |
   | `VAPID_SUBJECT` | `mailto:nikhil@example.com` (any email is fine) |

4. Click **Deploy**. Wait ~1 minute. When it's done, click **Continue to Dashboard** → you'll see your live web address, like `https://rcnk-tracker.vercel.app`. That's your app. Copy it.

The **7:30pm daily reminder is now automatic** — nothing else to set up.

---

## PART 3 — Install on both iPhones
Do this on **your** phone and **Rukmini's** phone:

1. Open the app's web address (from Part 2, Step C) in **Safari**.
2. Tap the **Share** icon (the square with an up-arrow) → scroll down → **Add to Home Screen** → **Add**.
3. **Open RCNK from the new home-screen icon** (not from Safari — this matters for alerts).
4. Tap your name, type the shared password, tap **Enter**.
5. Tap **Enable** on the alerts strip → **Allow**.

Done. Assign each other a task to test the ping. 🎉

---

## How you'll use it day to day
- **Today** tab: the two coloured cards up top show you vs. Rukmini and how much each of you has cleared today — your quick "who's behind" glance. Tap the circle to finish a task (you'll be asked for a quick remark first). Use **Mine / Rukmini's / All** to switch whose list you see. Tap **Completed** at the bottom to see the full history with everyone's remarks.
- **Assign** tab: type a task, pick who it's for, optionally set a due time, tap **Assign**. The other person gets a notification straight away.
- A **daily 7:30pm** notification lists anything still unfinished that was due that day.

---

## If something doesn't work
- **No alert when assigned a task:** make sure you opened the app from the **home-screen icon** and tapped **Allow**. Re-open it and tap the **bell** (top-right) to switch alerts on.
- **Tasks don't appear on the other phone:** re-check that `config.js` has the right Project URL and anon key, and that the SQL in Part 1 showed "Success".
- **Just want to see the design again:** open `preview.html` from your folder in any browser — it needs no setup.

## A note on privacy
Login is one shared password — simple and fine for the two of you, but light. Don't store anything sensitive. Want proper separate logins with Face ID later? Just ask.
