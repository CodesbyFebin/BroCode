# BroCODE — AI-assisted coding workspace (site and field guide)

**Live site:** https://codingagent.in

BroCODE is an AI-assisted coding workspace for editable source, reviewable changes and local projects (V3). AI proposals arrive as reviewable diffs, local edits are preserved, local checkpoints let you restore earlier versions, files export as ZIP or JSON, the mobile static preview inspects HTML with scripts disabled, and source is sent for AI help only with explicit consent. The Android release is in preparation; pricing has not been announced.

This repository holds the source of the public website: a fast, dependency-free static site with an 11-path field guide about AI-assisted coding.

## What's in the site

- **Home**: product overview, three-stage workflow (prompt, review, checkpoint and export), the guide vault, get-started steps and FAQ.
- **11 pillar guides** under `/guides/<pillar>/`, each with focused **cluster articles** under `/guides/<pillar>/<cluster>/`: getting started, prompting for code, editing source files, reviewing AI changes, checkpoints and recovery, static preview, exports and portability, privacy and safe AI use, Android workflows, publishing your project, and agent safety and verification.
- **About, FAQ, editorial policy and privacy** pages, plus a `404`.

## Repository structure

```
build.mjs          static generator (Node ESM, no dependencies)
config.mjs         SITE_URL, SITE_NAME, REPO_URL, UPDATED date
style.css          design system, inlined into every page (see DESIGN.md)
DESIGN.md          visual system spec ("Stranger Builds" brutalist / classified-file look)
content/
  p01.mjs … p11.mjs  one pillar each: summary, sections, steps, FAQs, clusters
  extras.mjs         extra sections merged into pillars and clusters
  index.mjs          loads and merges the pillars
  pages.mjs          simple pages and the homepage FAQ
  home.html          homepage body template
  site.js, home.js   small inline scripts (motion toggle, reveals; homepage intro and embers)
static/            favicon, og image, sample file, self-hosted fonts (OFL)
scripts/verify.mjs post-build checks
.github/           CI workflow, issue and PR templates
```

`dist/` is generated and gitignored.

## Build

Requires Node.js 20+. There are no npm dependencies.

```bash
npm ci
npm run build    # writes dist/
npm run verify   # internal links, canonicals, JSON-LD, sitemap
npm run serve    # http://localhost:8787 (needs python3)
```

## Deploy

`dist/` is a plain static folder. Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3 and so on): build command `npm run build`, output directory `dist`. Point `codingagent.in` at the host. CI also uploads `dist` as the `site-dist` artifact on every run. No deployment is configured in this repo.

## Content model

Each pillar module exports `{ n, slug, title, h1, desc, card, summary, sections[], steps?, faqs[], clusters[] }`. A cluster has the same shape minus `clusters`. A `section` is `{ h, p[], list? }`. Inline `` `code` `` in text is rendered as `<code>`. Edit content, run the build, and every page, the sitemap and the llms files update together.

Content rules: describe only what the product actually does. No invented features, prices, statistics, testimonials or compliance claims.

## SEO, AEO and GEO features

- Canonical URLs on `https://codingagent.in`, unique titles and descriptions, Open Graph and Twitter cards.
- One JSON-LD `@graph` per page: Organization, WebSite, SoftwareApplication, TechArticle, BreadcrumbList, FAQPage, HowTo and ItemList where relevant.
- **Answer-first pages (AEO):** every guide opens with a short, quotable answer, followed by question-shaped headings and an FAQ.
- **Generative engine optimisation (GEO):** `llms.txt` (an index of all guides) and `llms-full.txt` (full plain text) for AI assistants, plus a robots.txt that explicitly allows the major AI and search crawlers and links the sitemap.
- `sitemap.xml` with lastmod, breadcrumbs, internal pillar and cluster linking, and prev/next navigation.
- Performance: inline CSS, preloaded woff2 subsets with `font-display: swap` and fallback metrics, no framework, no third-party requests. Motion respects `prefers-reduced-motion` and has a visible toggle.

## Lighthouse (measured locally)

Lighthouse 12, run on a local static server against the home page, one pillar and one cluster, in mobile and desktop presets: **100 / 100 / 100 / 100** (Performance, Accessibility, Best Practices, SEO) on all six runs. These are local results from November 2026; production numbers depend on the host (compression and caching headers).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports: [SECURITY.md](SECURITY.md).

## License

- **Code** (generator, scripts, styles): [MIT](LICENSE).
- **Written content** in `content/`: the licence is the owner's choice and is not granted by the MIT licence unless the owner states otherwise.
- **Fonts** in `static/fonts/`: Anybody and Roboto Mono, SIL Open Font License 1.1 (`OFL-*.txt`).

If you cite this project, see [CITATION.cff](CITATION.cff).
