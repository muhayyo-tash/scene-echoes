# Deploy Scene Echoes (GitHub Pages)

Do these steps once. You do not need to edit code.

1. Create a GitHub account if you do not have one, at https://github.com/signup.
2. On GitHub, click **New repository**. Name it `scene-echoes`. Leave it empty (no README).
3. On your computer, in this project folder, run these commands, replacing `YOUR_USER` with your GitHub username:

```bash
git add .
git commit -m "Add Scene Echoes mixed reality prototype."
git remote add origin https://github.com/YOUR_USER/scene-echoes.git
git branch -M main
git push -u origin main
```

4. On GitHub, open the repository → **Settings** → **Pages**.
5. Under **Build and deployment**, set **Source** to **GitHub Actions**.
6. Wait for the **Deploy GitHub Pages** workflow to finish (the Actions tab).
7. The app URL is:

`https://YOUR_USER.github.io/scene-echoes/`

The animation lab is `https://YOUR_USER.github.io/scene-echoes/lab.html`.

8. Open that URL in the Meta Quest Browser and tap Enter.

## After you add real photos, models or a film

Drop files into `public/assets/` as described in the README, then:

```bash
npm run validate-timeline
git add public/assets
git commit -m "Add real sofa, book and film assets."
git push
```

Wait for Actions to finish, then refresh the headset browser.

## Testing the live conversion client later

Run `npm run mock-conversion-server`, set `CONVERSION_API_URL` in `src/config.ts` to `http://YOUR_PC_LAN_IP:8787` (Quest cannot use localhost of your laptop unless you tunnel), rebuild, and open the app with `?live=1`. If the mock is unreachable, the app falls back to the bundled GLB. The demo judges should keep manifest mode.
