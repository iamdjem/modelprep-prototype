# ModelPrep prototype, deploy guide

## Live demo

[https://iamdjem.github.io/modelprep-prototype/](https://iamdjem.github.io/modelprep-prototype/)

Every push to `main` auto-deploys via GitHub Actions. To work locally:

```bash
git clone https://github.com/iamdjem/modelprep-prototype.git
cd modelprep-prototype
npm install
npm run dev
```

This is a ready-to-deploy Vite + React project. Pick one of three paths below depending on how fast you want a public URL.

## What you'll need

- Node.js 18 or newer (`node --version` to check)
- A GitHub account (for paths B and C)
- A browser

## Run it locally first (2 minutes)

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. If it loads, builds, and you can drop files into it, you're ready to deploy.

To verify the production build works locally:

```bash
npm run build
npm run preview
```

Opens at `http://localhost:4173`. This is what the deployed version will look like.

---

## Path A: StackBlitz, instant, no install (2 minutes)

For when you just want a link in Discord right now and don't care about a custom domain.

1. Open `https://stackblitz.com/fork/github/vitejs/vite/tree/main/packages/create-vite/template-react`
2. Once it opens, delete the contents of `src/App.jsx` and paste the contents of this project's `src/App.jsx`.
3. In the Dependencies panel on the left, add `lucide-react`.
4. The app boots automatically. Click the "Share" button at the top to get a public URL like `stackblitz.com/edit/abc123`.

The URL works for anyone, no install needed. They click, they use it, they give feedback.

Downside: the URL has "stackblitz" branding, no custom domain.

---

## Path B: Vercel, polished and fast (5 minutes)

Recommended if you don't need a custom domain right away.

1. Create a new GitHub repo, e.g. `modelprep-prototype`.
2. Push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "ModelPrep prototype v0.3"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/modelprep-prototype.git
   git push -u origin main
   ```
3. Go to `https://vercel.com/new`.
4. Click "Import" next to your new repo. Vercel detects Vite automatically.
5. Click "Deploy". Done.

You get a URL like `modelprep-prototype-abc.vercel.app`. Every future git push auto-deploys.

To add a custom domain like `prep.makerstats.io`:
- In Vercel project settings, go to Domains, add `prep.makerstats.io`.
- In Cloudflare DNS for `makerstats.io`, add a CNAME `prep` pointing to `cname.vercel-dns.com`, proxy OFF (orange cloud off).

---

## Path C: Cloudflare Pages (10 minutes, recommended for you)

Best fit for your setup since `makerstats.io` is already on Cloudflare. You'll end up with the app at `prep.makerstats.io` and full integration with your existing DNS.

1. Push to GitHub as in Path B step 1-2.
2. Go to `https://dash.cloudflare.com`, pick your account.
3. Navigate to "Workers & Pages" in the left sidebar, click "Create application", pick the "Pages" tab, click "Connect to Git".
4. Authorize Cloudflare to access your GitHub, then pick the `modelprep-prototype` repo.
5. Configure the build:
   - Production branch: `main`
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: leave blank
   - Environment variables: none needed
6. Click "Save and Deploy". Wait ~90 seconds.

You get a URL like `modelprep-prototype.pages.dev`. Test it works.

### Add the custom domain (5 more minutes)

In your Cloudflare Pages project:
1. Go to the "Custom domains" tab.
2. Click "Set up a custom domain".
3. Enter `prep.makerstats.io`.
4. Cloudflare auto-detects that `makerstats.io` is in your account and offers to create the DNS record for you. Click "Activate domain".

Done. `https://prep.makerstats.io` now serves the app, with Cloudflare's SSL, caching, and global edge network in front. Every git push auto-deploys.

---

## Sharing for feedback

Once deployed, share the URL in the Bambu Lab Discord. Suggested message:

> Hey everyone, prototype of the multi-platform upload prep tool we discussed is live at [URL]. It's a draft, all client-side, nothing leaves your browser. Drop in a model and some renders, click through the 6 steps, hit Download .zip on the platform you want to test, see if the package matches what each platform actually wants. Brutally honest feedback welcome. @Marjan @Jaatinen3D @Kit Crafters

Pin the message, gather screenshots and notes, iterate.

---

## What's in this project

```
modelprep-deploy/
├── index.html              # Page shell with SVG favicon
├── package.json            # Dependencies
├── vite.config.js          # Vite build config
├── tailwind.config.js      # Tailwind config
├── postcss.config.js       # PostCSS config
├── public/
│   └── _headers            # Cloudflare Pages security headers
└── src/
    ├── main.jsx            # React entry, mounts App
    ├── index.css           # Tailwind directives
    └── App.jsx             # The whole ModelPrep prototype
```

Everything is client-side. No backend, no database, no API keys. The app:
- Loads JSZip lazily from CDN when you click "Download .zip".
- Loads Google Fonts (Big Shoulders Display, Space Grotesk, JetBrains Mono).
- Stores nothing remotely. Your model files stay in your browser.

---

## When you outgrow the prototype

This project is meant for feedback gathering, not production. When the feedback validates the direction, the next step is the real build per `MODELPREP_BUILD_HANDOFF.md`: TypeScript, Cloudflare Workers backend for OAuth + R2 asset hosting, IndexedDB persistence, real API uploads to Cults3D / MyMiniFactory / Thingiverse, payment integration via Lemon Squeezy, etc.

For now, the goal is: prove the workflow makes sense to your audience.
