# Web Annex Tutorial Manifest

**Purpose:** Track quality upgrades across all web-annex tutorials.
**Quality standard:** `00-what-is-multicriticality.html` (S187, July 2026).
**Target:** All tutorials at maximum quality for eventual publication on freethemath.org.

---

## Quality Standard (derived from 00-what-is-multicriticality.html)

| Feature | Required | Notes |
|---------|----------|-------|
| Tooltips | Yes | All non-obvious terms. IT-native language for physics concepts. |
| Citation footnotes | Yes | Tiny superscripts, easy to ignore. Real citations only. |
| Meta description | Yes | For LLM summarization and search. |
| Prose quality | Yes | No unsourced stats. Precise terminology. Active voice. |
| Interactive elements | Where appropriate | Canvas/SVG demos that demonstrate the concept. |
| Responsive design | Yes | Mobile-first. DPR-aware canvas. overflow-x on wide content. |
| Accessibility | Yes | prefers-reduced-motion, keyboard focus, tabindex on tooltips. |
| Theme | Match series | DN = dark observatory. Science = per-series. |
| OPSEC | Yes | Red-lines: the literal name "Diamond Node", jill, Metatron/Robin/Jason, NDA/DARPA/TQNN/Healer/guided-deduction, "pylon", internal session tags (S1xx/S2xx), and any living researcher framed as an outreach target. NOT red-lines: "skeletons", "RAF theory", "poised state", and normal citation of published work (Kauffman 1986, Hordijk & Steel, "named by Frank Wilczek") are fine public math. Public frame = "domain convergence" (never "Diamond Node"). Operator/EWS-detection language is permitted. |
| Nav links | Yes | Back to index + next/prev within series. |

---

## freethemath.org Structure Plan

The tutorials will eventually live at freethemath.org under this structure:

```
freethemath.org/
  /                           -- Landing page (from domain-convergence or new)
  /multicritical/             -- Multi-Critical Systems series (DN multi-critical)
    /00-what-is-multicriticality
    /01-glass-transition
    /02-active-matter
    /03-cardiac-tissue
    /04-protein-folding
    /05-brain
    /06-tokamak
  /bridges/                   -- The Four Missing Bridges
    /multicritical-gap        -- From skeleton-matrix / search-suppression
    /topological-protection   -- From skeleton-topology / structure-from-topology
    /catalytic-closure        -- From skeleton-closure / acs-closure-v2
    /computational-universality -- From skeleton-computation
  /magnetosphere/             -- Magnetospheric Science
    /tutorial                 -- Earth's Invisible Shield
    /tomography               -- Halloween 2003 case study
  /phase-transitions/         -- Phase Transition Fundamentals
    /criticality-bridges      -- Physical systems connecting domains
    /systems-chart            -- Physical systems x domain bridge
    /poised-state             -- Shadows of the Poised State
  /topology/                  -- Topological Mathematics
    /anyon-fusion             -- Fibonacci anyon fusion algebra
    /topology-closure         -- Where the Topology Lives
  /methodology/               -- Research Methods
    /miller-tutorial          -- Coevolving machines
    /domain-convergence       -- Animated introduction
  /about/                     -- Meta
    /ai-governance            -- Teaching an AI to Remember
    /letter-norton            -- A Note on Topological Protection
```

**Not migrated to freethemath.org:** Traveller content (s13-prep, s14-prep, maps, vtt-mockups), train-the-trainer (Claude Code specific).

**Pattern:** Each tutorial gets a clean URL slug. Series have index pages. Cross-references between tutorials use relative links within the freethemath structure. Shared CSS via a common stylesheet (extracted from 00-what-is-multicriticality.html patterns).

---

## Tutorial Inventory

### A. Diamond Node — Multi-Critical Series (PRIORITY 1)

| # | File | Lines | Title | Status | Tooltips | Footnotes | Interactive | Notes |
|---|------|-------|-------|--------|----------|-----------|-------------|-------|
| A1 | multi-critical/index.html | 732 | Multi-Critical Systems | **DONE** (S187) | 10 | 0 | SVG | Series landing page |
| A2 | multi-critical/00-what-is-multicriticality.html | 1714 | What Is Multicriticality? | **DONE** (S187) | 24 | 5 | 4 canvas, 2 SVG | Gold standard |
| A3 | multi-critical/01-glass-transition.html | 845 | Glass Transition | **DONE** (S187) | 16 | 5 | 3 SVG | |
| A4 | multi-critical/02-active-matter.html | 784 | Active Matter | **DONE** (S187) | 23 | 4 | 2 SVG | |
| A5 | multi-critical/03-cardiac-tissue.html | 766 | Cardiac Tissue | **DONE** (S187) | 13 | 4 | 2 SVG | |
| A6 | multi-critical/04-protein-folding.html | 713 | Protein Folding | **DONE** (S187) | 16 | 4 | 2 SVG, interactive | |
| A7 | multi-critical/05-brain.html | 745 | Brain | **DONE** (S187) | 15 | 5 | 3 SVG, interactive | |
| A8 | multi-critical/06-tokamak.html | 750 | Tokamak H-Mode Pedestal | **DONE** (S187) | 16 | 6 | 3 SVG, interactive | |

### B. Diamond Node — Skeleton Tutorials (PRIORITY 1)

| # | File | Lines | Title | Status | Tooltips | Footnotes | Notes |
|---|------|-------|-------|--------|----------|-----------|-------|
| B1 | multi-critical/skeleton-matrix.html | 673 | Multicritical Skeleton Profiles | ORPHAN | — | — | Not linked; skeletons/ is canonical |
| B2 | multi-critical/skeleton-topology.html | 322 | Skeleton 1: Topology | ORPHAN | — | — | Not linked; skeletons/ is canonical |
| B3 | multi-critical/skeleton-closure.html | 259 | Skeleton 3: Closure | ORPHAN | — | — | Not linked; skeletons/ is canonical |
| B4 | multi-critical/skeleton-computation.html | 293 | Skeleton 4: Computation | ORPHAN | — | — | Not linked; skeletons/ is canonical |
| B5 | skeletons/index.html | 533 | The Four Mathematical Skeletons | **DONE** (S187) | 13 | 0 | Landing page |
| B6 | skeletons/skeleton-topology.html | 364 | Skeleton 1: Topology | **DONE** (S187) | 12 | 3 | Canonical |
| B7 | skeletons/skeleton-closure.html | 301 | Skeleton 3: Closure | **DONE** (S187) | 9 | 3 | Canonical |
| B8 | skeletons/skeleton-computation.html | 335 | Skeleton 4: Computation | **DONE** (S187) | 12 | 3 | Canonical |
| B9 | skeletons/skeleton-matrix.html | 983 | Multicritical Skeleton Profiles | **DONE** (S187) | 5 | 0 | Canonical; interactive radar |

### C. Diamond Node — Searches & Index (PRIORITY 2)

| # | File | Lines | Title | Status | Notes |
|---|------|-------|-------|--------|-------|
| C1 | diamond-node/index.html | 334 | Domain Convergence Research | **DONE** (S187) | 9 tips, 0 fn | Main DN landing |
| C2 | anyon-family-sweep/index.html | 590 | Anyon Family Sweep | **DONE** (S187) | 11 tips, 3 fn | |
| C3 | braiding-search/index.html | 304 | Braiding Phase Space Search | **DONE** (S187) | 11 tips, 2 fn | |
| C4 | lattice-search/index.html | 385 | Lattice Braiding Search | **DONE** (S187) | 11 tips, 2 fn | |

### D. Science Tutorials (PRIORITY 2)

| # | File | Lines | Title | Status | Notes |
|---|------|-------|-------|--------|-------|
| D1 | magnetosphere-tutorial/index.html | 1603 | The Magnetosphere: Earth's Invisible Shield | **DONE** (S187) | 11 tips, 3 fn |
| D2 | magnetospheric-tomography/index.html | 12362 | Magnetospheric Tomography — Halloween 2003 | **DONE** (S187) | 10 tips, 2 fn |
| D3 | magnetospheric-tomography/altitude-coherence.html | 788 | Altitude Coherence | **DONE** (S187) | 6 tips, 0 fn (dashboard) |
| D4 | magnetospheric-tomography/current-sheet-3d.html | 381 | Current Sheet 3D | **DONE** (S187) | 5 tips, 0 fn (dashboard) |
| D5 | magnetospheric-tomography/satellite-convergence.html | 650 | Satellite Convergence | **DONE** (S187) | 6 tips, 0 fn (dashboard) |

### E. Phase Transition & Criticality (PRIORITY 2)

| # | File | Lines | Title | Status | Notes |
|---|------|-------|-------|--------|-------|
| E1 | criticality-bridges/index.html | 2226 | Criticality Bridges | **DONE** (S187) | 12 tips, 0 fn (inline citations) |
| E2 | physical-systems-chart/index.html | 1999 | Physical Systems x Domain Bridge | **DONE** (S187) | 6 tips, 0 fn (chart page) |
| E3 | poised-state-survey/index.html | 1535 | Shadows of the Poised State | **DONE** (S187) | 11 tips, 0 fn |
| E4 | domain-convergence/index.html | 1937 | Domain Convergence — Animated Intro | **DONE** (S187) | 10 tips, 0 fn (inline citations) |

### F. Topology & Closure (PRIORITY 2)

| # | File | Lines | Title | Status | Notes |
|---|------|-------|-------|--------|-------|
| F1 | structure-from-topology/index.html | 789 | Structure from Topology | **DONE** | 13 tips, 0 fn, meta, reduced-motion |
| F2 | topology-closure/index.html | 604 | Where the Topology Lives | **DONE** | 9 tips, 0 fn, meta, reduced-motion. OPSEC: mentions Robin by name (pre-existing) |
| F3 | acs-closure/index.html | 702 | Autocatalytic Closure (v1) | ORPHAN | Superseded by v2; no inbound links |
| F4 | acs-closure-v2/index.html | 805 | Autocatalytic Closure (v2) | **DONE** | 10 tips, 3 fn (Hordijk&Steel 2004, Kauffman 1986, Mossel&Steel 2005), meta, reduced-motion |
| F5 | anyon-fusion/index.html | 1266 | Fibonacci Anyon Fusion Algebra | **DONE** | 12 tips, 3 fn, meta, reduced-motion |

### G. Methodology & Meta (PRIORITY 3)

| # | File | Lines | Title | Status | Notes |
|---|------|-------|-------|--------|-------|
| G1 | miller-tutorial/index.html | 1451 | John H. Miller — Coevolving Machines | **DONE** | 12 tips, 3 fn, meta, reduced-motion |
| G2 | miller-tutorial/replication.html | 997 | Miller Replication | **DONE** | 7 tips, 0 fn (data page), meta, reduced-motion |
| G3 | miller-tutorial/simulation.html | 2986 | Miller Simulation | **DONE** | 9 tips (5 param labels + 4 bridge annotation), 0 fn, meta, reduced-motion |
| G4 | miller-tutorial/tests.html | 1317 | Miller Tests | **DONE** | 0 tips (test runner, no prose), meta, reduced-motion |
| G5 | ai-governance/index.html | 1350 | Teaching an AI to Remember | **DONE** | 12 tips, 0 fn (essay format), meta, reduced-motion |
| G6 | search-suppression/index.html | 720 | Content-Selective Search De-Indexing | **DONE** | 8 tips, 0 fn (reproducibility report), meta, reduced-motion |
| G7 | train-the-trainer/index.html | 550 | Claude Code Train-the-Trainer | **DONE** | 6 tips, 0 fn, meta, reduced-motion. Not for freethemath |
| G8 | letters/kw-norton/index.html | 367 | A Note on Topological Protection | **DONE** | 7 tips, 2 fn, meta, reduced-motion |

### H. Site Infrastructure

| # | File | Lines | Title | Status | Notes |
|---|------|-------|-------|--------|-------|
| H1 | index.html | 751 | Web Annex — Bruce Stephenson | **DONE** | 6 tips, 0 fn (landing page), meta, reduced-motion |

### X. Non-Tutorial Content (NO UPGRADE — game/personal)

| # | File | Lines | Title | Notes |
|---|------|-------|-------|-------|
| X1 | s13-prep/ | 1537 | Traveller S13 prep | 3 files |
| X2 | s14-prep/ | 2180 | Traveller S14 prep | 6 files |
| X3 | maps/ | 1572 | Traveller maps | 2 files |
| X4 | vtt-mockups/ | 842 | VTT mockups | 1 file |

---

## Upgrade Log

### S187 (2026-07-09)

**A2: 00-what-is-multicriticality.html — COMPLETE**
- 24 tooltips added (physics terms in IT-native language)
- 5 citation footnotes (Andrews 1869, Sciortino 2024, Blume-Capel 1966, Cook 2000, Griffiths 1970)
- Meta description added
- "20% Problem" → "The Expensive Failures" (unsourced stat removed, Cook citation added)
- "Standard EWS fails" → "Standard single-parameter EWS fails"
- Detection comparison text made state-aware (checks actual gauge values)
- Accumulation description tightened
- Tooltip + footnote CSS system established (reusable across series)

**A3: 01-glass-transition.html — COMPLETE**
- 16 tooltips added (condensed matter physics, energy landscape, mode-coupling temperature, ergodicity, weakly first-order, Kauzmann temperature, configurational entropy, second-order, correlation length, order parameter, specific heat, fragility, bicritical point, parameter space, phase transitions, universality class, codimension-two, Gardner transition, marginally stable, scaling laws, jamming, Edwards-Anderson overlap, density autocorrelation, mean-field theory, RFOT, point-to-set correlation, Angell fragility index, Ginzburg-Landau, O(2)/XY universality, Kosterlitz-Thouless, replica symmetry breaking, scaling exponents)
- 5 citation footnotes (Pettini 2025, Angell 1995, Charbonneau 2024, Kirkpatrick & Thirumalai 2015, Parisi & Zamponi 2010)
- Meta description added
- Reduced-motion support added
- Nav links fixed (added prev link to 00-what-is-multicriticality)
- "landmark study" → "study" (let the reader judge)
- Added summary sentence linking fragility to codimension-two distance

**A4: 02-active-matter.html — COMPLETE**
- 23 tooltips added (active matter, topological defects, nematic liquid crystals, critical exponents, phase transition, Manna universality, β, directed percolation, universality classes, braid, pseudo-Anosov, topological entropy, golden ratio, torus, Euler characteristic, KT physics, directed percolation [tech], absorbing-state transitions, Janssen-Grassberger conjecture, Gauss-Bonnet theorem, hyperuniform, spectral radius, Burau matrix)
- 4 citation footnotes (Doostmohammadi+Hinrichsen, Memarian+Klein, Manna 1991, PNAS 2025)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**A6: 04-protein-folding.html — COMPLETE**
- 16 tooltips added (first-order phase transition, van't Hoff enthalpy, packing fraction, jamming transition, critical exponent, power laws, self-organized criticality, intrinsically disordered proteins, edge of chaos, bulk modulus, hydrophobic effect, Kruskal-Wallis, Gardner transition, marginally stable, shear modulus, energy landscape)
- 4 citation footnotes (Grigas 2025, Bryngelson & Wolynes 1987, Uversky 2019, Charbonneau 2024 + Parisi & Zamponi 2010)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added
- "landmark finding" → "a finding" (let the reader judge)
- Existing interactive packing fraction explorer preserved

**A7: 05-brain.html — COMPLETE**
- 15 tooltips added (neuronal avalanches, power law, scale-free, phase transition, fine-tuning problem, Griffiths phases, modular-hierarchical, spiral waves, topological defects, topological charge, susceptibility, winding number, fluid intelligence, positive selection, universality class)
- 5 citation footnotes (Hengen & Shew 2025, Moretti & Muñoz 2013, Xu et al. 2023, PNAS 2025, Beggs & Plenz 2003)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**A8: 06-tokamak.html — COMPLETE**
- 16 tooltips added (tokamak, H-mode, pedestal, transport barrier, ELMs, self-organized critical, power law, magnetic islands, flux surfaces, resonant magnetic perturbations, rational flux surfaces, topological phase transition, Reynolds stress, zonal flows, edge of chaos, signal-to-noise ratio)
- 6 citation footnotes (Chapman et al. 2001, Park et al. 2024, McMillan et al. 2018, Huang et al. 2025, Wagner et al. 1982, Diamond et al. 2005)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added
- "landmark result" → "result" (let the reader judge)

**B5: skeletons/index.html — COMPLETE**
- 13 tooltips added (emergent properties, multi-critical profile, braid groups, knot invariants, golden ratio, power laws, renormalization group, catalytic closure, RAF theory, autopoiesis, cellular automata, edge of chaos, Turing universality)
- Meta description added
- Tooltip CSS added (footnote CSS included but no footnotes — landing page)
- Audit: B1-B4 (multi-critical/skeleton-*.html) are orphaned duplicates — skeletons/ is canonical (linked from multi-critical/index.html)

**B6: skeletons/skeleton-topology.html — COMPLETE**
- 12 tooltips added (braid generator, topology, pseudo-Anosov, TEPO, Fibonacci numbers, topological protection, topological insulators, anyons, Ising anyons, Fibonacci anyons, quantum dimension, Jones polynomial)
- 3 citation footnotes (Kitaev 2003, Kane & Mele 2005, Nobel 2016)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**B7: skeletons/skeleton-closure.html — COMPLETE**
- 9 tooltips added (catalytic closure, RAF, enzymes, network property, essential reactions, autopoiesis, (M,R)-systems, hypercycles, graph-theoretic)
- 3 citation footnotes (Hordijk & Steel 2004, Kauffman 1986, Maturana & Varela 1980)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**B8: skeletons/skeleton-computation.html — COMPLETE**
- 12 tooltips added (distributed computation, pheromone trails, glider, Turing-complete, phase transition, edge of chaos, Boolean networks, power laws, dynamic range, mutual information, self-organized criticality, reservoir computing)
- 3 citation footnotes (Langton 1990, Beggs & Plenz 2003, Bak/Tang/Wiesenfeld 1987)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**B9: skeletons/skeleton-matrix.html — COMPLETE**
- 5 tooltips added (mathematical profile, Major, minor, self-referential, tetrahedron)
- Meta description added
- Tooltip CSS added (interactive tool — no footnotes needed)

**A1: multi-critical/index.html — COMPLETE**
- 10 tooltips added (phase transitions, universality class, order parameter, multi-critical point, codimension-two, directed percolation, Kosterlitz-Thouless, Griffiths phase, Gardner transition, skeletons)
- Meta description added
- Tooltip + reduced-motion CSS added (hero-flow animation, SVG animate, fade-in, card transitions)
- No footnotes (landing page)

**C1: diamond-node/index.html — COMPLETE**
- 9 tooltips added (criticality, topology, autocatalysis, self-catalysis, RAF closure, Chern-Simons theory, Fibonacci anyons, edge of chaos, Lyapunov exponent)
- Meta description added
- Tooltip + reduced-motion CSS added
- No footnotes (landing page)

**C2: anyon-family-sweep/index.html — COMPLETE**
- 11 tooltips added (fusion algebras, Clebsch-Gordan rules, quantum dimension, Clifford group, magic state distillation, dense in SU(N), Quantum Double, Drinfeld double, subfactor, MTC, edge of chaos)
- 3 citation footnotes (Freedman/Larsen/Wang 2002, Kitaev 2003, Hordijk/Steel 2004)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**C3: braiding-search/index.html — COMPLETE**
- 11 tooltips added (complexity classes, Class IV, fusion rule, R-matrices, F-matrices, braid group, Lyapunov exponent, Yang-Baxter, unitary matrix, quasi-periodic, entropy rate)
- 2 citation footnotes (Wolfram 2002, Nayak et al. 2008)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**C4: lattice-search/index.html — COMPLETE**
- 11 tooltips added (spatially extended systems, commutator norm, Fibonacci word, Thue-Morse, product-state approximation, period-doubling, Fourier spectra, domain-wall interference, entanglement, Matrix Product State, Lindblad master equation)
- 2 citation footnotes (Schollwöck 2011, Feigenbaum 1978)
- Meta description added
- Tooltip + footnote + reduced-motion CSS added

**D1–D5: Science tutorials — COMPLETE**
- D1 magnetosphere-tutorial: 11 tips, 3 fn. D2 tomography index: 10 tips, 2 fn.
- D3–D5 dashboards: 6/5/6 tips (lighter treatment). All: meta + reduced-motion.

**E1–E4: Phase transition & criticality — COMPLETE**
- E1 criticality-bridges: 12 tips. E2 systems-chart: 6 tips. E3 poised-state: 11 tips. E4 domain-convergence: 10 tips.
- No footnotes (inline citations or chart pages). All: meta + reduced-motion.

**F1: structure-from-topology/index.html — COMPLETE**
- 13 tooltips (field-aligned currents, injection boundaries, 0-cochains/1-cochains, translational invariance, graph coboundary operator, discrete exterior calculus, antisymmetry, gradient sector, curl-free, circulation, directed cycle, kriging, variograms). Meta + reduced-motion added.

**F2: topology-closure/index.html — COMPLETE**
- 9 tooltips. Meta + reduced-motion added. OPSEC: Robin mentions pre-existing, untouched.

**F4: acs-closure-v2/index.html — COMPLETE**
- 10 tooltips, 3 footnotes (Hordijk & Steel 2004, Kauffman 1986, Mossel & Steel 2005).
- Meta + reduced-motion added.

**F5: anyon-fusion/index.html — COMPLETE**
- 12 tooltips, 3 footnotes. Meta + reduced-motion added.

**G1–G2: miller-tutorial — COMPLETE**
- G1 index: 12 tips, 3 fn. Converted from title-attribute tooltip system to standard .tip .tt.
- G2 replication: 7 tips. Both: meta + reduced-motion added.

**G3–G4: miller-tutorial apps — COMPLETE**
- G3: 9 tooltips (5 param labels + 4 bridge annotation: asocial equilibrium, evolutionary revolution, autocatalysis, RAF theory). G4: 0 tips (test runner). Meta + reduced-motion.

**G5: ai-governance/index.html — COMPLETE**
- 12 tooltips (sycophancy, context leakage, FTS5, YAML frontmatter, WAL mode, copy-paste gate, role collapse, half-life, etc.). Already had meta + reduced-motion.

**G6: search-suppression/index.html — COMPLETE**
- 8 tooltips (de-indexing, HTTP 200, site: operator, Control, robots.txt, noindex, PageRank, Wayback Machine). Already had meta + reduced-motion + CSS from prior session.

**G7: train-the-trainer/index.html — COMPLETE**
- 6 tooltips. Meta + reduced-motion added. Not for freethemath.

**G8: letters/kw-norton/index.html — COMPLETE**
- 7 tooltips (topological protection, quasiparticles, anyons, braid groups, topological invariants, persistent homology, Fröhlich's condensation). 2 footnotes. Meta + reduced-motion (including svg animateMotion).

**H1: index.html (site landing page) — COMPLETE**
- 6 tooltips. Meta + reduced-motion added.

**B9 fix: skeletons/skeleton-matrix.html**
- Added missing reduced-motion CSS (prefers-reduced-motion: reduce).

**S201 (2026-07-19): diamond-node full audit + upgrade — COMPLETE**
- 3-agent read-only audit + adversarial red-team of every diamond-node tutorial; 4-agent implementation pass; correctness red-team before ship.
- NEW page `skeletons/skeleton-criticality.html` (S2 — the missing 4th skeleton); dead S2 card made live; nav chain now Topology→Criticality→Closure→Computation→Matrix.
- Deleted 4 orphaned duplicate skeleton pages under `multi-critical/`.
- Fixed broken tracker/footer links on all 7 multi-critical pages (`../../../js` → `../../js`).
- Correctness: anyon-sweep TQC (SU(2)_4 not braiding-universal + FLW k=4/k=8 exceptions; D(S_3) solvable-group correction; SU(2)_5 formula; Freedman M.H.); lattice denominator 54/1300; cardiac Feigenbaum reframed; active-matter ν→β; removed leaked "S163g" tag.
- Citations: added Sormunen/Gross 2025, Ashwin 2025, Frank&Jacobs 2026, Fang et al. 2025, Li (Nat Phys 2026); completed Cook 2000, Guldager-Andersen 2025, de la Cotte 2025; DOWNGRADED brain PNAS (wrong-scope) + REMOVED fabricated "Huang et al. 2025".
- Q2 "◆ our result" hypothesis markers on the program's own unpublished results (9 files).
- Accordions (short-on-load) + many tooltips + bridge-letter tooltips (A=Topology, B=Criticality, C=Autocatalysis/Closure, D=Computation) throughout. Completeness-adjacent overclaims softened. OPSEC clean; HTML validated.

---

## Unlisted / Private-Share Pages

Not linked from `docs/index.html` nav; robots-disallowed. Shared by direct URL only.

| Page | URL | Audience | Notes |
|------|-----|----------|-------|
| EWS: multivariate DEV for cardiac discordant alternans | `/ews/cardiac-mv-ews/` | Thomas Bury (private pre-call brief) | Reproduces Bury 2023 chick-heart EWS + proposes multivariate eigenvalue direction. Red-teamed (8 lenses) + citation-verified. NOT a joint/endorsed doc. |
