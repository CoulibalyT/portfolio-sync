# Portfolio Sync

Capture and optimize screenshots of your live projects automatically. Built with Puppeteer and Sharp.

## Installation

```bash
npm install portfolio-sync
```

## Quick Start

```bash
# 1. Create a config file
npx portfolio-sync init

# 2. Edit portfolio-sync.config.json with your projects

# 3. Capture screenshots
npx portfolio-sync capture
```

## Configuration

Edit `portfolio-sync.config.json` (see `portfolio-sync.config.example.json`):

```json
{
  "projects": [
    {
      "name": "my-project",
      "url": "https://my-project.vercel.app",
      "pages": [
        { "path": "/", "name": "home" },
        { "path": "/about", "name": "about" }
      ],
      "viewport": { "width": 1440, "height": 900 },
      "outputDir": "./public/images/my-project"
    }
  ],
  "options": {
    "quality": 90,
    "format": "webp",
    "maxWidth": 1440,
    "waitFor": 2000,
    "fullPage": false,
    "retries": 3
  }
}
```

### Project options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | string | Yes | Project identifier |
| `url` | string | Yes | Base URL of the live project |
| `pages` | array | Yes | Pages to capture (`path` + `name`) |
| `viewport` | object | No | Width/height (default: 1920x1080) |
| `outputDir` | string | Yes | Where to save screenshots |
| `auth` | object | No | Authentication config (see below) |

### Page options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `path` | string | Yes | Path appended to project `url` |
| `name` | string | Yes | Screenshot filename (without extension) |
| `fullPage` | boolean | No | Override global `fullPage` for this page |
| `expectedUrlPattern` | string (regex) | No | After navigation, fail the capture if `page.url()` doesn't match. Useful to catch silent redirects to a signin page. Example: `"/dashboard$"` |

### Global options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `quality` | number | 90 | Image quality (0-100) |
| `format` | string | `"webp"` | Output format: webp, jpeg, png, avif |
| `maxWidth` | number | — | Resize images to this max width |
| `waitFor` | number | 2000 | Wait time (ms) before capture |
| `fullPage` | boolean | false | Capture full scrollable page |
| `retries` | number | 3 | Retry attempts on failure |

## Authentication

For protected pages (dashboards, admin panels), add an `auth` block to your project:

```json
{
  "name": "my-app",
  "url": "https://my-app.com",
  "auth": {
    "type": "form",
    "loginUrl": "/login",
    "usernameSelector": "#email",
    "passwordSelector": "#password",
    "submitSelector": "button[type='submit']",
    "username": "${APP_EMAIL}",
    "password": "${APP_PASSWORD}",
    "waitForSelector": "nav"
  },
  "pages": [
    { "path": "/dashboard", "name": "dashboard" }
  ],
  "outputDir": "./public/images/my-app"
}
```

Credentials use environment variables (`${VAR}` or `$VAR`). Create a `.env` file:

```
APP_EMAIL=user@example.com
APP_PASSWORD=yourpassword
```

**Supported auth types:** `form`, `basic`, `bearer`, `cookie`, `custom`

### Custom auth with an external script file

Inline `script` strings work but are painful to maintain (JSON escaping, no linting). Use `scriptFile` to point at a real JS module:

```json
{
  "auth": {
    "type": "custom",
    "navigateTo": "/auth/signin",
    "scriptFile": "./scripts/auth/my-app.js",
    "waitForSelector": "nav[data-app-ready]"
  }
}
```

The module must export a function `(page, context) => Promise<void>`:

```js
// scripts/auth/my-app.js
module.exports = async function(page, { projectUrl, env }) {
  await page.waitForSelector('#password-input');
  await page.type('#password-input', env.MY_APP_PASSWORD);
  await page.click('button[type="submit"]');
};
```

`context.env` is `process.env`, so credentials live in `.env` — no need for `${VAR}` placeholders. Inline `script` also supports `${VAR}` substitution now (v1.1+).

`waitForSelector` on custom auth waits for a real DOM signal instead of a blind `waitFor` delay.

## CLI Commands

```bash
# Capture all projects
npx portfolio-sync capture

# Capture a specific project
npx portfolio-sync capture -p my-project

# Preview what would be captured (no browser launched)
npx portfolio-sync capture --dry-run

# List configured projects
npx portfolio-sync list

# Create a sample config
npx portfolio-sync init
```

### Options

| Flag | Description |
|------|-------------|
| `-c, --config <path>` | Config file path (default: `portfolio-sync.config.json`) |
| `-p, --project <name>` | Capture only this project |
| `-d, --dry-run` | Show what would be captured without doing it |
| `--debug` | On failure, save the page screenshot, DOM, URL and error to `./debug/` |
| `--debug-dir <path>` | Directory for `--debug` artifacts (default: `./debug`) |

## Features

- **Retry on failure** — auto-retries failed captures (configurable)
- **Hash comparison** — skips unchanged screenshots to avoid useless commits
- **Image optimization** — resize + compress via Sharp (webp, jpeg, png, avif)
- **Auth support** — login to protected pages before capturing (`form`, `basic`, `bearer`, `cookie`, `custom` — the last one via inline `script` or an external `scriptFile`)
- **URL assertions** — per-page `expectedUrlPattern` catches silent redirects to signin pages instead of saving a useless screenshot
- **Debug artifacts** — `--debug` dumps screenshot, DOM and URL to `./debug/` on failure so you can see what the browser saw
- **Dry-run mode** — preview captures without launching the browser

## GitHub Actions

Automate screenshots with a workflow (`.github/workflows/update-screenshots.yml`):

```yaml
name: Update Portfolio Screenshots

on:
  schedule:
    - cron: '0 0 * * 0' # Weekly
  workflow_dispatch:

jobs:
  update-screenshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install
      - run: npx portfolio-sync capture
        env:
          APP_EMAIL: ${{ secrets.APP_EMAIL }}
          APP_PASSWORD: ${{ secrets.APP_PASSWORD }}
      - run: |
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git config user.name "github-actions[bot]"
          git add public/images
          git commit -m "chore: update portfolio screenshots" || exit 0
          git push
```

## License

MIT
