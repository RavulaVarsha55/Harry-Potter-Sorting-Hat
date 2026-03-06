# AI Worker (Free Tier)

This Cloudflare Worker adds AI house analysis using OpenRouter free models.

## 1) Install and login

```bash
npm i -g wrangler
wrangler login
```

## 2) Deploy

```bash
cd ai-worker
cp wrangler.toml.example wrangler.toml
wrangler secret put OPENROUTER_API_KEY
wrangler deploy
```

After deploy, copy your Worker URL:

`https://<your-worker>.workers.dev/sort`

## 3) Connect to frontend

In `index.html`, set:

```html
<script>
  window.SORTING_HAT_AI_ENDPOINT = "https://<your-worker>.workers.dev/sort";
</script>
```

## Notes

- Keep API keys in Worker secrets only.
- Frontend falls back to local sorting if AI is unavailable.
