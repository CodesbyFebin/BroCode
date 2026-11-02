# Contributing

Thanks for helping improve the BroCODE site and field guide.

## Setup

```bash
cd site && npm ci
npm run build && npm run verify
npm run serve   # http://localhost:8787
```

## Content rules

- Describe only what BroCODE actually does. No invented features, prices, statistics, benchmarks, testimonials, partners or compliance claims.
- Open each guide with a short, direct answer, then use question-shaped headings and FAQs.
- Keep advice general and verifiable; link to related pillar and cluster pages.
- Use curly apostrophes (’) inside JS string content, and keep URLs (slugs) stable once published.

## Design and performance

Follow [DESIGN.md](site/DESIGN.md). Keep pages framework-free, keep the inline JS small, respect `prefers-reduced-motion`, and keep AA contrast. Pull requests should keep Lighthouse at 100 in all four categories on mobile and desktop.

## Pull requests

1. Branch from `main`.
2. Make the change and run (from `site/`) `npm run build && npm run verify`.
3. For app changes, run `npm run test:agent` from `app/`; for Python, `uv run pytest -q` from `agents-py/`.
4. Open a PR using the template. CI must pass.
