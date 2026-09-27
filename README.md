# mrsmalikdaycare.com

Website for Mrs. Malik's Daycare, hosted on Cloudflare Pages (free tier).

- **Public homepage** (`/`): cover, story, daily schedule, FAQ, gallery, and a contact / schedule-a-visit form that emails `mrsmalikdaycare@gmail.com`.
- **Admin dashboard** (`/admin`): edit homepage text, hours, FAQs, and photos; manage gallery photos; create family accounts and upload private photos for each family; read inquiries.
- **Family portal** (`/portal`): enrolled families log in to see and download their own photos. No self-registration: accounts are created by an admin.

## Branches

| Branch | Deploys to |
| --- | --- |
| `main` | Preview: `main.mrsmalikdaycare.pages.dev` |
| `prod` | Live site: `mrsmalikdaycare.com` |

Work on `main`, check the preview, then open a pull request `main → prod` and merge it to go live.

## How it's built

No build step and no dependencies: plain HTML/CSS/JS plus Cloudflare Pages Functions.

```
public/            static files (login, admin, portal pages, CSS, JS)
functions/         Cloudflare Pages Functions (routes)
  index.js         "/" homepage, rendered from the saved content
  api/[[path]].js  "/api/*" JSON API
  media/[[path]].js "/media/:id" public photos
src/               server code shared by the functions
  api.js           all API endpoints
  auth.js          password hashing (PBKDF2), sessions, rate limiting
  db.js            D1 schema (auto-created on first request)
  content.js       default homepage content + validation
  render.js        homepage HTML
  email.js         inquiry emails via Resend
dev/server.mjs     local test server (Node 22+, no install needed)
```

## Cloudflare settings

**Build settings**: Framework preset *None*, build command empty, **build output directory `public`**.

**Bindings** (Settings → Bindings), for both Production and Preview:

| Type | Variable name | Value |
| --- | --- | --- |
| D1 database | `DB` | `daycare-db` (production) / `daycare-db-preview` (preview) |
| R2 bucket | `PHOTOS` | `daycare-photos` |

**Variables and secrets** (Settings → Variables and Secrets):

| Name | Type | Purpose |
| --- | --- | --- |
| `SETUP_KEY` | Secret | One-time key used to create the first admin at `/login` |
| `RESEND_API_KEY` | Secret | Sends inquiry emails (resend.com) |
| `EMAIL_FROM` | Text (optional) | e.g. `Mrs. Malik's Daycare <hello@mrsmalikdaycare.com>` once the domain is verified in Resend |
| `INQUIRY_TO` | Text (optional) | Defaults to `mrsmalikdaycare@gmail.com` |

Database tables are created automatically; there are no migrations to run.

## Run locally

```
node dev/server.mjs
# open http://localhost:8788  (setup key: dev-setup-key)
```

Local data is stored in `.dev-data/` (git-ignored).
