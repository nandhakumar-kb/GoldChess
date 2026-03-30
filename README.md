# GrandMaster Chess

A browser-based chess game with animated landing page, AI opponent, move highlights, pawn promotion modal, and game-over overlays.

## Project Structure

- `index.html`: Landing page
- `game.html`: Chess board page
- `assets/`: Images and audio assets
- `css/`: Stylesheets
- `js/`: Frontend scripts and chess engine vendor file
- `tests/`: Smoke tests for chess engine behavior

## Run Locally

Use any static server from the project root.

### Python

```bash
python -m http.server 8000
```

Open:

- `http://localhost:8000/index.html`
- `http://localhost:8000/game.html`

## Test

```bash
npm test
```

(or)

```bash
node tests/test_chess.js
```

## Promotion Test Mode

Quickly verify promotion behavior:

- `http://localhost:8000/game.html?test=promotion`

Move pawn `a7 -> a8`, then choose a piece in the promotion modal.

## Deploy to Vercel

This project is static and deploys without a build step.

1. Push repository to GitHub.
2. Import the repo in Vercel.
3. Framework preset: `Other`.
4. Build command: leave empty.
5. Output directory: leave empty.

`vercel.json` already includes:

- Rewrite from `/game` to `/game.html`
- Asset caching headers for `/assets/*`
- Basic security headers

## Push to GitHub

```bash
git init
git add .
git commit -m "Prepare chess portfolio for GitHub and Vercel"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
