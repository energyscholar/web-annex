# The station contract

One line runs through the science tutorials on this site. Each **station** on the line is a pair of
pages: the existing tutorial (the **expert layer**) and a short `start/index.html` page beside it (the
**beginner layer**). The **ride map** at `docs/ride/` draws the whole line. This file says what every
page on the line must carry, and how each requirement is checked.

Every clause below has a mechanical **probe** in `scripts/conform.py`: a check over the page source
that needs no browser. A clause that cannot be checked mechanically is listed in the appendix
("judged, not measured") and never changes a page's tier.

```
python3 scripts/conform.py                        # score every page, print the clauses missed most
python3 scripts/conform.py --page ashkin-teller/index.html
python3 scripts/conform.py --gate H,N             # exit 1 if any page misses an H- or N-clause
python3 scripts/conform-selftest.py               # the fixtures: each probe shown able to fail
python3 scripts/check-stations.py                 # the two manifests against schema and disk
```

## Definitions

- **Station list.** `docs/ride/stations.json` (schema beside it) is the one source of truth for the
  line: each station's id (`0` to `9`, then `T`), its expert page(s), its beginner page (`start`,
  `null` until written), its state (`live`, `coming`, `held`) and its place on the ride map. Spur pages
  are listed there too, each with the station it leaves from. A station's row exists before its page.
- **Tracks.** `scripts/tracks.json` puts every page on the *science* or the *how-we-work* track. The
  game pages are named only by their directory prefixes and are never scored.
- **Expert pages.** Every `expert` and `also` path in the station list, and every spur page.
- **Beginner surfaces.** `docs/index.html`, every page under `docs/ride/`, and every
  `start/index.html`.
- **The switch.** The one way from a beginner surface into the expert layer: a link carrying
  `data-switch="expert"` whose text says what it does, for example
  *"Go deeper: the physics version of station 3, Kosterlitz-Thouless"*.
- **The hatch.** The one way back: on every expert page, as static markup directly inside `<body>`
  and before the page's first heading,
  `<a class="hatch" data-station="N" href="…">back to the easy version</a>`. It leads to the station's
  `start/` page, or, until that exists, to the ride map at `ride/#station-N` (window view).

Two requirements govern everything else:

- **R1, deliberate entry.** The expert layer opens only through the switch. No link, scroll position,
  hover, redirect or default route from a beginner surface lands a reader on an expert page.
- **R2, the escape hatch.** Every expert page carries the hatch, the same markup on every page,
  visible without scrolling, never a modal, in plain words.

## E: an expert page

| Clause | Requirement | Probe |
|---|---|---|
| E1 | a meta description | `<meta name="description" content="…">` with non-empty content |
| E2 | a title of at most 70 characters | `<title>` text, whitespace collapsed, 1–70 characters |
| E3 | tooltips on named things | at least five elements with class `tip` |
| E4 | sources cited by DOI | at least one string of the form `10.NNNN/…` |
| E5 | the physics editorial standard | the page carries the mark `PHYSICS EDITORIAL STANDARD` |
| E6 | three-depth accordions, closed | a `<details>` of class `l1` and one of class `l2` (or summaries reading "Working equations" and "Full derivation"); no `<details open>` |
| E7 | play/pause on every animation | if the page or a script it loads uses `requestAnimationFrame` or `setInterval`, there is a button labelled Play or Pause in the markup or in a string the page's scripts write |
| N1 | station nav | a static `<nav class="station-nav" data-station="N">` for this page's station containing a link to the ride map, and `js/station-nav.js` loaded (it adds the previous and next stations) |
| H1–H5 | the hatch | see H below |

A spur page is held to E1–E7, H1–H5 and **N2** instead of N1: a static
`<nav class="station-nav" data-spur="N">` with a link reading "back to the line" to the ride map.

## H: the hatch

| Clause | Requirement | Probe |
|---|---|---|
| H1 | present | a static `<a class="hatch">` in the page source (not injected by a script) |
| H2 | same station | its `data-station` is this page's station (a spur's: the station it leaves from), and its `href` resolves to that station's `start` page, or to `ride/index.html#station-N` while `start` is `null` |
| H3 | above the fold | it is a direct child of `<body>` and comes before the first `<h1>` and the first `<main>` in source order |
| H4 | always visible | `docs/css/station-nav.css` gives `.hatch` `position: sticky`, and the page links that stylesheet |
| H5 | plain words, not a modal | it is an ordinary link whose text is exactly "back to the easy version"; no `role` attribute; no `<dialog>` on the page |

## B: a beginner page (`start/index.html`)

| Clause | Requirement | Probe |
|---|---|---|
| E1, E2 | meta description, short title | as above |
| B1 | short | at most 900 words of visible text |
| B2 | arithmetic only | no `<math>`, no TeX delimiters (`\(`, `\[`, `$$`), no ∫ ∑ ∂ ∇ |
| B3 | one interactive | exactly one element carrying `data-interactive` |
| B4 | three quiz items | exactly three elements carrying `data-quiz-item` |
| B5 | names tooltipped | at least one element with class `tip` (that *every* name is tooltipped is judged) |
| B6 | station nav | a static `<nav class="station-nav" data-station="N">` for this station |
| S1–S5 | the switch | see S below |

## S: the switch (every beginner surface)

| Clause | Requirement | Probe |
|---|---|---|
| S1 | no accidental entry | every relative or same-site `href` is resolved; any link whose target is an expert page must carry `data-switch="expert"` |
| S2 | labelled | every `data-switch="expert"` element is a link to an expert page, and its text starts "Go deeper" and names the destination after a colon |
| S3 | no redirect, no default route | no `<meta http-equiv="refresh">`; no script on the page or loaded by it sets `location`, calls `location.assign` or `location.replace`, or calls `window.open` |
| S4 | one control (start pages only) | exactly one switch, and it leads to this station's own expert page |
| S5 | no script-made way across | no script loaded by the page reads a station's `expert` or `also` field, so no link a script draws can lead into the expert layer |

`docs/index.html` and the pages under `docs/ride/` are held to E1, E2, S1, S2, S3 and S5.

## W: the how-we-work track (light standard)

| Clause | Requirement | Probe |
|---|---|---|
| W1 | a meta description | as E1 |
| W2 | navigation back | a link to the landing page or to a parent directory |
| W3 | tooltips | at least one element with class `tip` |

No quizzes, accordions or station nav are asked of this track.

## X: safety (every scored page)

| Clause | Requirement | Probe |
|---|---|---|
| X1 | no private names, places or vocabulary | no match against a list of patterns kept outside this repository and passed with `--opsec-patterns FILE`; a directory path in a URL that happens to contain a listed word is not a match |
| X2 | no book | no match against a list of terms passed with `--book-terms FILE` |

The lists themselves are never committed here; without the files the two clauses are not run.
Safety clauses are reported with every page but do not set its tier: a match is read by a person
and either fixed or recorded as an allowed use (an ordinary English word, or a cited author's name
inside a citation).

## Tiers

- **Science track** (expert, spur, start, surface and other science pages): *current* when no
  applicable clause is missed; *ok* when one or two are missed and none of them is E1, E2, a hatch,
  nav or switch clause; *primitive* otherwise.
- **How-we-work track:** *current* with nothing missed, *ok* with one miss, *primitive* with two or more.
- **Game pages:** not tiered, not read.

`conform.py` writes a "clauses missed most" table into the local `TUTORIAL-MANIFEST.md`, between its
own markers, each time it scores the whole site.

## Appendix: judged, not measured

These are part of the contract but have no mechanical probe; they are checked by a reader.

- Every named thing is tooltipped on first use (B5, E3 count tooltips; they cannot tell which names
  need one).
- The hatch is visible without scrolling at every viewport width (H3 and H4 are the stand-ins).
- The switch's text names its destination clearly (S2 checks the form, not the clarity).
- A beginner page is in plain words and the ride's voice.
- Every chart axis carries a label and a two-part tooltip (the quantity; its units or meaning).
- Every animation starts paused, and `prefers-reduced-motion` is honoured (E7 checks only that a
  play/pause control exists; the site's page verifier checks reduced motion in a browser).
