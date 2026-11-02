# Deploying the BrowserGuard site to Netlify

Two ways to do this. **Route A** takes about two minutes and needs no GitHub
connection — start there if you just want a link to show someone today.
**Route B** connects the repository so future edits redeploy themselves.

Everything is already prepared: `netlify.toml`, `site/_headers` and a built
`deploy/browserguard-site.zip`. You do not need to edit any file to deploy.

---

## Before you start

You need a Netlify account (free). Sign up with GitHub or email at
<https://app.netlify.com/signup>. The free plan is enough: 100 GB bandwidth and
300 build minutes per month, and this site uses no build minutes at all.

Sanity check first, in the workspace:

```bash
npm run site:check     # should print: Site audit passed: 7 pages ... engine in sync
npm run site:serve     # http://localhost:8099 — click through all four tools
```

---

## Route A — drag and drop (fastest)

1. **Get the archive.** In this workspace, download
   `deploy/browserguard-site.zip` (219 KB). If it is missing, rebuild it:

   ```bash
   npm run site:zip
   ```

2. **Open the drop page.** Go to <https://app.netlify.com/drop>.

3. **Drag the zip onto the page.** Drop the `.zip` file itself — do not extract it
   first. Netlify unpacks it and starts the deploy. If you prefer, you can drag the
   whole `site` folder instead; both work.

4. **Wait for "Deployed".** This takes about 10–20 seconds. You will get a URL like
   `https://sparkling-panda-1a2b3c.netlify.app`.

5. **Check it worked.** Open the URL and confirm:
   - the homepage loads with the blue hero and four tool cards;
   - `…/tools/link-checker.html` returns a verdict for `http://paypa1.example/verify`;
   - `…/tools/password-strength.html` reacts as you type;
   - `…/tools/privacy-check.html` lists your browser's signals.

6. **Claim the site** (so it does not expire). Click **Claim this site** /
   **Sign up** in the banner and finish creating the account. A drag-and-drop site
   that is never claimed is temporary.

7. **Rename it.** Site configuration → **Change site name** → `browserguard-tools`
   or similar. Your URL becomes `https://browserguard-tools.netlify.app`.

### Verification of the security headers

After deploying, check that the CSP is live. In a terminal:

```bash
curl -sI https://YOUR-SITE.netlify.app/ | grep -i -E "content-security|x-frame|referrer"
```

You should see `content-security-policy`, `x-frame-options: DENY` and
`referrer-policy: no-referrer`. If they are missing, the `_headers` file did not
make it into the archive — rebuild with `npm run site:zip` and redeploy.

To confirm the policy is not just present but correct, open DevTools → Console on
the deployed site. There should be **no** CSP violation messages. If you see
"Refused to execute inline script", something re-introduced an inline script;
`npm run site:check` catches that before you deploy.

---

## Route B — connect the repository (updates itself)

**Read this first:** the site currently lives on the branch
`arena/2c751b31-browserguard`. The repository's `main` branch is 6 commits behind
and does **not** contain `site/` yet. Netlify deploys from `main` by default, so
you must merge the branch first — otherwise Netlify will publish an empty site or
fail with "publish directory not found".

1. **Open a pull request** from `arena/2c751b31-browserguard` into `main`:

   ```bash
   gh pr create --base main --head arena/2c751b31-browserguard \
     --title "BrowserGuard v1.7 extension fixes and security-tools site" \
     --body "Adds the static security-tools site, v1.7 extension fixes, and Netlify deployment configuration."
   ```

   Review it, then merge with `gh pr merge <number> --merge`.

2. **Confirm `main` has the site.** `git ls-tree -d --name-only origin/main`
   should list `site` alongside `src`, `tests` and the rest.

3. **Import the project.** In Netlify: **Add new site → Import an existing
   project → Deploy with GitHub**. Authorise Netlify if asked, and pick
   `Jessedrt/BrowserGuard`.

4. **Use the settings Netlify reads from `netlify.toml`.** The form may show empty
   values — leave them as they are. If you prefer to type them:

   | Field | Value |
   | --- | --- |
   | Branch to deploy | `main` |
   | Build command | *(empty)* |
   | Publish directory | `site` |

5. **Deploy.** First build finishes in a few seconds because nothing is compiled.

6. **Check automatic updates.** Make any small edit, commit and push to `main`.
   Netlify should start a new deploy by itself. That is the whole benefit of
   Route B.

### Migrating a drag-and-drop site to a repo site

If you already deployed with Route A and now want Route B, you can keep the same
URL: in the new site's settings, delete the old site **after** pointing the new one
at the same site name, or simply rename the new site to reuse the old name once the
old one is deleted.

---

## After you have the URL — one command

Masthead metadata has to be absolute for link previews on WhatsApp, LinkedIn or X,
and a sitemap has to be absolute too. Both are automated:

```bash
npm run site:url -- https://YOUR-SITE.netlify.app   # og:url, og:image, canonical, sitemap, robots
npm run site:check                                   # confirms nothing is inconsistent
npm run site:zip                                     # rebuild the upload archive
```

`site:url` rewrites all seven pages, generates `site/sitemap.xml` and points
`robots.txt` at it. It is safe to re-run — run it again if you rename the site or
attach a custom domain.

Then redeploy: drag the rebuilt zip onto Netlify Drop again, or push to `main` if
you connected the repository. Finally, test the card by pasting the URL into
<https://www.opengraph.xyz/> — you should see the blue BrowserGuard card with the
title and subtitle.

---

## Optional: a custom domain

Netlify gives free HTTPS (Let's Encrypt) on custom domains.

1. Buy a domain (`.com` is roughly $10–12/year; `.dev` and `.app` are cheaper).
2. Netlify: **Domain management → Add a domain** → enter it.
3. Either point your registrar's nameservers at Netlify, or add the `A`/`CNAME`
   records Netlify shows you.
4. Wait for DNS (minutes to a few hours). Netlify provisions the certificate
   automatically.

Then repeat the three finishing steps above with the real domain.

---

## Things to check, and things not to say

- [ ] All seven pages load on the deployed site.
- [ ] The link checker gives a verdict for a pasted URL and for email text.
- [ ] The generator produces a different password each time you press ↻.
- [ ] The privacy check fills in all 14 signals.
- [ ] `curl -sI` shows the CSP header.
- [ ] `npm run site:url -- <your-url>` has been run and the social card resolves.
- [ ] No CSP errors in the browser console.
- [ ] The site works at phone width.

In your report, describe the hosting honestly: Netlify serves a **static** site;
all analysis runs in the visitor's browser. There is no server, no database and no
account system, and the only outbound request is the optional breach check that
sends a five-character hash prefix. If an examiner asks what would need a backend,
the honest answer is: live DNS, WHOIS, HTTP-header and TLS checks — those are
listed as future work in the project README.
