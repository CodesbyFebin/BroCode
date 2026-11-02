# Stranger Builds Design System — Extracted & Generalized

> Clean, brand-free template extracted from strangerbuilds.com (Halloween Hackathon 2026). No NERDCONF / Duck / Sponsor references. Ready to skin for any product.

---

## 1. Core Concept
**Brutalist carnival / classified-file horror**. Deep ink void + acid highlight + physical paper artifacts (tickets, carts, stamps, seals, redacted lines) + analog film damage + parallax floating objects (saucer, bolt). Feels like a government archive that got abducted.

Mood: tense, playful, electric, lo-fi but premium.

---

## 2. Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--ink` | `#080b0d` | Page background, intro mask |
| `--card` | `#101115` | Cards, ticket, laptop base |
| `--card-2` | `#161a1e` | Hover, secondary |
| `--bone` | `#eee5d3` | Primary text on dark |
| `--bone-dim` | `#a9a39a` | Secondary text, eyebrows |
| `--yellow` | `#ffe62b` | Primary CTA, plinth, charging beam, selection |
| `--red` | `#e20b1b` | Logo, urgency, error, seal |
| `--cyan` | `#8be9ed` | Beam, live badge, bolt glow |
| `--pink` | `#ff5b9e` | Accent 2, ticket border |
| `--green` | `#b8ff9f` | Success, verified badge |
| `--paper` | `#faf6ef` | Ticket / letter background |

**Gradients:**
- Beam: `linear-gradient(90deg, var(--red), var(--yellow), var(--cyan))`
- Haze: `radial-gradient(ellipse at 50% 0%, rgba(255,230,43,.18), transparent 60%)`
- Oval portal: `radial-gradient(ellipse, transparent 42%, rgba(0,0,0,.72))`
- Plinth shadow: `radial-gradient(ellipse, rgba(0,0,0,.6) 0%, transparent 70%)`

**Never use:** pure white #fff for large surfaces, use bone. Never use gray-blue.

---

## 3. Typography

**Display:**
- Family: `Anybody ExtraExpanded` Black 900 → fallback `Anton`, `Impact`, `sans-serif-condensed`
- Weight: 900
- Case: UPPER
- Tracking: `0.02em` to `0.13em`
- Line: `0.85` to `0.95`
- Transform: skewed -2deg on hero big words via `transform: skewX(-2deg)`

**Body / Label:**
- Family: `Anybody` Black 800 → fallback `Inter Black`
- Weight: 800 for chips, 700 for h3

**Mono:**
- Family: `Roboto Mono`, `ui-monospace`
- Weight: 400/700
- Use for: HUD, counters, telemetry, ticket codes, receipt hashes

**Hierarchy:**
- `h1`: 12vw / 120px max, expanded black
- `h2`: 7vw / 84px
- `eyebrow`: Mono 12px, letter-spacing .24em, uppercase, color var(--bone-dim) or var(--yellow)
- `ticket title`: 32-48px expanded
- `body p`: 16px/1.6, Anybody 400

**Italic signature:** `font: italic 900 3.3vmin/1.2 Anybody` + yellow + tracking .13em → used for event tagline above logo.

---

## 4. Layout Primitives

**Frame:**
- 4px solid border on viewport: `box-shadow: inset 0 0 0 4px var(--card)`
- Top rail nav: right vertical rail with `writing-mode: vertical-rl`, dots active
- Skip-link hidden until focus

**Sections:**
- `b-page` wrapper: max 1440px centered, padding 0 24px → 0 48px
- `sa-wrap`: same but with relative + z-index 2

**Grids:**
- Monument: centered stack, plinth top 480px, base 520px, skew
- Carts: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`, gap 28px, rotate random -6deg to 8deg per card
- Tape: flex marquee, `animation: marquee 28s linear infinite`, logos scale var(--s)

---

## 5. Motion System

**Intro (0-3s):**
- Canvas: 650 stars polar projection, z tunnel `distance = 280*(1-exp(-3.4t)) + 120t + rush²*900`
- Wash: translucent `#080b0d` alpha .36 trail
- Bolts: 3 bolts at `1.0s, 1.62s, 2.3s` side -1/1, 10 segments jitter .16, draw white 2.5px over cyan 11px alpha .32
- Logo: `scale(.05) rotate(-9deg) → scale(1.12) @33.3% → scale(1) → scale(12) @84%`
- Glitch: `drop-shadow(1.8vmin 0 #8be9ed) drop-shadow(-1.8vmin 0 #ffe62b)` at 33.3%, 35%, 54%
- Shake: steps(1) translate 1.7vmin
- Flash: white opacity .9 at 33.4%
- HUD counter: easeOutQuad `1 - (1-t/2.2)²` *100, stages text change at 0,45,90%
- Portal punch: `destination-out` circle growing `pow(open,2.3)*reach*.56`

**Scroll:**
- Reveal: IntersectionObserver adds `.is-in`, triggers `b-float`
- `b-float-ch`: each char `--i`, delay `i*0.04s`, `translateY(110%) → 0`, cubic-bezier(.16,1,.3,1)
- `reveal`: opacity 0 translateY 22px → 0
- Parallax: `data-depth` -10 to 42, `translate3d(0, scroll*depth*0.01,0)`

**Hover:**
- Cart: rotate to 0, scale 1.02, shadow `0 12px 40px rgba(0,0,0,.6)`
- Button: glitch 0.1s, background shift yellow → white
- Sticker peel: corner curl via radial gradient at bottom-right

---

## 6. Components

### 6.1 Button
```css
.btn{ display:inline-flex; gap:10px; padding:14px 28px; background:var(--yellow); color:var(--ink); font:900 16px Anybody ExtraExpanded; letter-spacing:.04em; text-transform:uppercase; border:2px solid var(--ink); box-shadow:4px 4px 0 var(--ink); transform:skewX(-3deg)}
.btn svg{ width:14px; fill:currentColor}
.btn:hover{ transform:skewX(-3deg) translate(-2px,-2px); box-shadow:6px 6px 0 var(--ink); filter:drop-shadow(1px 0 0 var(--cyan)) drop-shadow(-1px 0 0 var(--pink))}
.btn-small{ padding:8px 14px; font-size:12px}
.btn-hero{ padding:18px 36px; font-size:20px}
```

### 6.2 Tape Marquee
```css
.tape{ background:var(--yellow); color:var(--ink); border-top:2px solid var(--ink); border-bottom:2px solid var(--ink); overflow:hidden; white-space:nowrap; padding:12px 0}
.tape-track{ display:flex; align-items:center; gap:24px; animation:marquee 28s linear infinite}
.tape-label{ font:900 14px Anybody ExtraExpanded; text-transform:uppercase}
.tape-logo{ height:24px; width:auto; filter:grayscale(1) contrast(1.2)}
@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
```

### 6.3 Monument / Plinth
- `.sa-num`: 180px ExtraExpanded Black, `text-stroke: 2px var(--ink)`
- Face layer + depth layer (offset 4px, color var(--red) opacity .6)
- `.sa-plinth-top`: yellow, skewed, text "in ...", centered
- `.sa-plinth-base`: black 3d extruded via `box-shadow: 0 20px 0 var(--ink), 0 40px 60px rgba(0,0,0,.6)`
- Fog: absolute bottom, gradient white → transparent, blur 12px

### 6.4 Cart (Artifact Card)
```css
.sa-cart{ position:relative; transform:rotate(var(--r)); transition:.3s}
.sa-shell{ background:var(--card); border:2px solid var(--ink); padding:0; overflow:hidden}
.sa-body{ height:8px; background:repeating-linear-gradient(90deg, var(--ink) 0 8px, transparent 8px 12px)}
.sa-label{ padding:20px}
.sa-chip{ display:inline-block; background:var(--yellow); color:var(--ink); font:700 10px Mono; letter-spacing:.12em; padding:4px 8px; text-transform:uppercase}
.sa-redacted{ background:var(--ink); color:var(--ink); display:flex; gap:8px}
.sa-redacted b{ background:var(--bone); width:100%; height:12px}
.sa-seal{ position:absolute; right:-12px; bottom:-12px; width:56px; height:56px; background:var(--red); border-radius:50%; border:2px solid var(--bone); display:grid; place-items:center}
.sa-lock{ color:var(--bone)}
```

### 6.5 Ticket
- Cream paper `#faf6ef`, torn edge via `clip-path: polygon(...)` with 2px jags
- Perforation: dashed line `border-left: 2px dashed var(--ink)`
- Stub: right 30% with vertical text
- Hover: rotate to 0deg

### 6.6 Badge / Ribbon
- Ribbon band: yellow skewed -2deg, black text
- Medal: red circle with `$`, white border
- Live badge: cyan bg, black text, pulse `box-shadow: 0 0 0 0 var(--cyan)` animation

### 6.7 Embers / Particles
- Canvas fixed, 120 particles, size .6-1.3, alpha .18-.62, color random red/yellow/cyan, move up -0.3px/frame + sin drift
- Spawn at bottom, recycle at top

---

## 7. FX Layers (fixed, pointer-events none)

1. `.grain` – svg turbulence fractalNoise baseFrequency .9 numOctaves 3, opacity .22
2. `.embers` – canvas particles
3. `.lantern` – radial vignette `radial-gradient(ellipse at 50% 20%, transparent 42%, rgba(0,0,0,.72))` + repeating-linear scanlines
4. `.frame` – inner border 4px
5. `.flash` – white full-screen opacity 0, triggered on bolt

Order z: grain 999, embers 10, lantern 11, frame 12, flash 13, intro 1000

---

## 8. Iconography

- Bolt: `M15 0 L2 18 h8 L7 32 L22 13 h-8z` fill currentColor
- Lock: `M6 10V7a6...` for classified carts
- Arrow: `↗` unicode, not svg, for links
- Star: `✦` for separators

---

## 9. Sound / Interaction Cues

- Sound toggle: 4 bars `i` height 12px, animate scaleY when `aria-pressed=true`
- Motion toggle: pauses all `animation-play-state: paused` on `[data-motion]` images

---

## 10. Responsive Breakpoints

- `<768px`: tapes logos 0.6 scale, monument 84px, carts 1 col, rail hidden, hero-stack column
- `768-1024`: 2 col carts
- `>1024`: 3-4 col, rail visible

`@media (max-aspect-ratio:3/4)` – logo 78vmin

`prefers-reduced-motion` – intro disabled, animations none, tapes static

---

## 11. Content Blocks (structure to copy)

1. Hero: byline + logo + portal oval + headline FIND YOUR ___ IN 7 DAYS + date/cities + backers + CTA + vault link
2. Prizes: rays + bills + monument + ribbon
3. Tape: communities/logos marquee
4. Game: 3 stages – Ship it / Get roasted / Find users (image + LIVE/SOLD badge + 01/02/03)
5. Vault: 4 classified carts (hard problems / real users) with lock
6. Get-in: ticket + pact steps, slack link, week timeline
7. FAQ: 6 details open, each with `--c` color and `--r` rotation, summary data-n 01-06
8. Why: letter + shout NERDS JUST WANNA HAVE FUN with UFO float
9. Organizer proof: video poster, stamp 25K+
10. Last hackathon: reel with side-project graveyard + burn faike
11. Footer: NERDCONF word + scene (cow + UFO), fog, ticket-fin with RULES/TERMS/SLACK

---

## 12. How to Skin for Any Brand

- Replace `--yellow` with your primary (keep high contrast on ink)
- Replace logo .webp – keep same dimensions 739x499 stacked
- Replace hero-duck – any mascot 512x512, still + motion webp
- Tape logos – swap src, keep `--s` scale var for uniform height
- Monument number – change data-t text (e.g., 10K → 50K)
- Cart chips – change sponsor svgs
- All copy in `<h2>` aria-label stays, visual uses `b-float` spans generated via JS
- Keep grain + bolts + UFO – they are theme, not brand

---

## 13. Checklist to Implement

- [ ] Add font preloads `AnybodyExtraExpanded-Black.woff2`, `Anybody-Black.woff2`
- [ ] Set `html.brand-intro-active` class before first paint, remove after 3s or on input
- [ ] Canvas intro isolated in IIFE, no external deps
- [ ] All motion checks `matchMedia('(prefers-reduced-motion: reduce)')`
- [ ] `sessionStorage` key `intro-seen` to avoid replay on back_forward
- [ ] Embers canvas requestAnimationFrame, DPR=1 to avoid DPR² cost
- [ ] `data-depth` parallax on scroll via `transform3d`
- [ ] Marquee duplicated twice for seamless loop
- [ ] Film filter SVG `<filter id="film">` with 3 levels film/m/s for responsive blur
- [ ] Buttons with skew + bolt svg

End of spec.
