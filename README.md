# Harry Potter Sorting Hat App

A whimsical, Hogwarts-themed web app that sorts you into a house using:
- A 5-question Sorting Ceremony quiz
- AI-style personality analysis from your written response
- Animated sorting narration and suspense reveal
- Shareable house result text

## Run locally

Open [index.html](index.html) in a browser.

## Deploy on GitHub Pages

1. Create a new GitHub repo.
2. Push these files to the `main` branch.
3. Go to `Settings` -> `Pages`.
4. Under Build and deployment, select `GitHub Actions`.
5. The included workflow at `.github/workflows/pages.yml` deploys automatically.

Your live site URL will be:
`https://<your-username>.github.io/<your-repo-name>/`

## Optional: Enable Free AI Sorting

This app now supports optional real AI house decisions via a backend endpoint.

1. Deploy the worker in [ai-worker/README.md](ai-worker/README.md).
2. Copy your Worker endpoint: `https://<your-worker>.workers.dev/sort`
3. In `index.html`, set:

```html
<script>
  window.SORTING_HAT_AI_ENDPOINT = "https://<your-worker>.workers.dev/sort";
</script>
```

If AI is unavailable, the app automatically falls back to local sorting logic.

## Project files

- `index.html` - app layout and UI
- `styles.css` - magical visual theme and animations
- `script.js` - quiz logic, optional AI endpoint integration, sorting engine
- `ai-worker/` - optional Cloudflare Worker for free AI backend
- `.github/workflows/pages.yml` - GitHub Pages deployment workflow
