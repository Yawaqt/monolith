# Monolith 40k website – setup

This folder is the whole website: a team portal with everything from the "Monolith Matrix Teams" sheet, plus an Apps area (starting with the Collection Tracker). Logins, permissions and data run on **Supabase** (free). The site files go on **GitHub Pages** (free) and can move to your own domain later.

**Try it first:** upload the files (step 3) without filling in `assets/config.js`. The site then runs in **demo mode** with your real sheet data, only in your browser, plus a "Viewing as" switch to preview each role.

---

## 1. Create the Supabase project (about 5 min)

1. Sign up at **supabase.com**, then **New project**.
2. Name it `monolith`, choose a strong database password (save it somewhere), and pick region **Central EU (Frankfurt)**. Click **Create**.
3. Wait about a minute until the project is ready.

## 2. Create the database and move your sheet data over

1. In Supabase, open **SQL Editor → New query**.
2. Open `supabase/schema.sql` from this folder, copy everything, paste it in and click **Run**. You should see "Success. No rows returned".
3. Open a new query, paste the whole of `supabase/seed.sql` and **Run**. This imports your 10 players with their armies, all 118 games, 4 events with replies, and the Kasse entries.

## 3. Put the site online (GitHub Pages)

1. On GitHub, create a new **public** repository, e.g. `monolith`.
2. **Add file → Upload files**: drag in everything from this folder: `index.html`, `manifest.webmanifest`, and the `assets` and `apps` folders. The folder structure must stay as it is. (The `supabase` folder and this guide are optional.)
3. **Settings → Pages**: choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then **Save**.
4. After a minute the site is live at `https://yawaqt.github.io/monolith/` (demo mode for now).

## 4. Connect the site to Supabase

1. In Supabase go to **Project Settings → API** (or **Connect**) and copy the **Project URL** and the **anon public** key.
2. Edit `assets/config.js` on GitHub (open the file, click the pencil icon) and paste them in:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ…',
   ```
   Then **Commit changes**. The anon key is meant to be public; the database permissions protect your data.
3. In Supabase go to **Authentication → URL Configuration**:
   - **Site URL:** `https://yawaqt.github.io/monolith/`
   - **Redirect URLs:** add the same address.

## 5. Create your admin account

1. Open the site and click **Konto erstellen / Create account**. Confirm the email Supabase sends you.
2. **The first account ever created automatically becomes Admin.** Do this yourself before sharing the link.
3. Go to **Mitglieder / Members** and link your account to the player **Miki**.

## 6. Invite the team

Send the link to the team. Everyone creates an account and starts as **Guest** (apps only). Under **Members** you set their role and link them to their player from the old Anmeldung.

| Role | Can do |
|---|---|
| **Guest** | Apps area (Collection Tracker, saved to their own account). Sees no team data. |
| **Team** | Sees all team pages. Edits their own armies, logs their own games (including internal games they played), answers events for themselves, rates their own Master Matrix column, sees only their own Kasse entries. |
| **Captain** | Everything Team can do, plus: create and edit events, change anyone's event reply, edit any game, manage players, the Live Matrix rows, opponent teams and saved pairings. **No Kasse access.** |
| **Admin** | Everything, including the Kasse and member roles. |

The database enforces these rules itself, so they hold even if someone tinkers with the website code.

---

## Optional

- **Sign in with Google:** Supabase → **Authentication → Providers → Google**. Follow Supabase's steps (you need a Google OAuth client, as with the tracker), then set `GOOGLE_LOGIN: true` in `assets/config.js`.
- **Own domain:** buy one (e.g. `monolith40k.at`), enter it under GitHub → Settings → Pages → Custom domain, and change the Site URL and Redirect URLs in Supabase to the new address.
- **On the phone:** open the site in Safari → Share → **Add to Home Screen**. It then opens like an app.

## Good to know

- **Free-plan pause:** Supabase pauses free projects after a week with very little activity. Your data stays; you click **Resume project** in the Supabase dashboard. With the team using the site regularly this rarely happens.
- **Old sheet:** the website doesn't change the Google Sheet. After the switch, enter new games on the website only.
- **More apps:** each app lives in its own folder under `apps/` and gets a card on the Apps page.

## What's in the folder

```
index.html              the website
manifest.webmanifest    home-screen app settings
assets/config.js        ← your Supabase details go here
assets/*.js, style.css  website code
assets/demo-data.js     your sheet data for demo mode
apps/collection/        Collection Tracker
supabase/schema.sql     database tables + permissions (run once)
supabase/seed.sql       your data from the Google Sheet (run once)
```

## Wachhalter und Backups (GitHub Actions)

**Supabase wach halten** (`.github/workflows/keepalive.yml`): läuft alle 3 Tage von selbst und macht eine kleine Leseabfrage, damit das Gratis-Projekt nicht pausiert wird. Keine Einrichtung nötig.

**Wöchentliches Backup** (`.github/workflows/backup.yml`): jeden Sonntag eine verschlüsselte Sicherung der Datenbank (Spiele, Konten, Turniere, News …), 90 Tage aufbewahrt. Fotos sind nicht enthalten.

Einmalig einrichten – GitHub → Repository → Settings → Secrets and variables → Actions → *New repository secret*:

1. `SUPABASE_DB_URL` – Supabase → Projekt → **Connect** → „Session pooler“ → Verbindungs-URL kopieren und `[YOUR-PASSWORD]` durch das Datenbank-Passwort ersetzen (vergessen? Supabase → Project Settings → Database → *Reset database password*).
2. `BACKUP_PASSWORD` – ein langes, eigenes Passwort. **Gut aufheben** – ohne dieses Passwort lässt sich ein Backup nicht öffnen.

Testen: GitHub → Actions → „Datenbank-Backup“ → *Run workflow*. Fertige Backups liegen beim jeweiligen Lauf unter *Artifacts*.

Backup öffnen bzw. zurückspielen (auf einem Computer mit PostgreSQL 17):

```
gpg --decrypt monolith-backup-JJJJ-MM-TT.dump.gpg > backup.dump
pg_restore --list backup.dump              # Inhalt ansehen
pg_restore -d "<SUPABASE_DB_URL>" --data-only --table=matches backup.dump   # z. B. nur eine Tabelle zurückholen
```
