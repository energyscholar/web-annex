# Criticality Math Kernel: sources

Every statement on `index.html` traces to one of the 36 entries below. Each entry gives the
file, the line number and the quoted text.

**Kernel.** `github.com/Relational-Relativity-Corporation/abr-kernel`, branch `kernel-v9`, commit
`af5fd6f` (2026-10-24), Apache-2.0 (`LICENSE:3`). Line numbers come from
`git show af5fd6f:<path> | cat -n`. Short names: **plain** = `docs/kernel/abr_operators_plain.md` ·
**notation** = `docs/kernel/operators_notation_and_constraint.md` · **ref** =
`docs/kernel/kernel_reference.md` · **roles** = `docs/kernel/role_separation_and_operator_application.md` ·
**spec** = `docs/kernel/v9_specification.md` · **ovs** = `docs/kernel/observable_variable_sets.md` ·
**ops** = `src/operators.rs` · **conf** = `tests/v9_conformance.rs`.

**Paper.** B. M. Stephenson and R. Macomber, *Convergent Discovery of Critical Phenomena Mathematics
Across Disciplines*, a preprint at arXiv:2601.22389 (paper repository `README.md:7`), licensed CC BY 4.0
(paper README, `README.md:18`; not the kernel README). **MAIN** = `Stephenson_CrossDomainCriticality_2026.tex` and **SUPP** =
`Stephenson_CrossDomainCriticality_2026_supplementary.tex`, numbered with `cat -n`.

**Naming.** The repository calls itself "the ABR/ABRCE kernel" (README:15) and is titled "ABR Invariant
Relational Kernel — Kernel V9" (README:1). The package is `abr-kernel` (README:335). "V9 enforcement …
is under development on the `kernel-v9` branch" (README:292-293). C is "a declared projection, not a
kernel operator" (notation:17; again at notation:31, "C is not a kernel operator in either kernel").

---

| # | Quote or close paraphrase | Source |
|---|---|---|
| F1 | "Change is the primary observable." "Relation is the invariant structure of change." "The operators do not produce change. They read it." | plain:9, 13, 17 |
| F2 | "This framework introduces one primitive …: **A DIRECTED RELATION DECLARED FROM OBSERVABLE INFORMATION.**" There are three roots: "COMPLEXITY", "CHANGE AS THE ONLY OBSERVABLE CONSTANT" and "BOUNDED DOMAIN OF ANALYSIS". "Standard mathematics constructs relations from objects. This framework takes the directed relation itself as primitive." | ref:47-50, 58, 66, 73, 82-84 |
| F3 | "Observable → M → numerical projection in D → declared topology → operators → calculated result → comparison with observables." "No numerical result is itself an observable." | ref:101-102, 109; README:25-26 |
| F4 | "A measurement mapping M must be declared before any operator acts. The operators act on M(o) only … The number is not the observable itself." | plain:42-43; notation:7 |
| F5 | "Where information an operator needs has not been declared through M, that operator is not evaluated. Nothing is substituted for the missing information." "A 0.0 produced by an operator over declared information is a calculated result … **Not evaluated ≠ evaluated with result 0.0.**" | plain:45; ref:113-118 |
| F6 | "A statement is admissible when every quantity in it can be traced to an observable through a declared measurement mapping M." "Declaration is never a substitute for traceability to an observable through M." | plain:23, 28; notation:5 |
| F7 | "Every declared relation has exactly one admissible direction — the direction traceable to an observable through M." The reverse "requires a separate observable that supports that direction independently." "A declared structure where every edge has a matching reverse edge signals a declaration error." | plain:67, 69, 77; notation:13 |
| F8 | "A ring declares that a node is its own relational predecessor … The ring fails at the closing edge, and the closing edge is the ring." "Rings and tori are inadmissible." | plain:79-81; ref:320-323 |
| F9 | "Δ(x)[e] = x[s] − x[t] for each declared edge e = (s, t)." "Take the directed difference and nothing else." "Δ is A under a declared renaming." | plain:116-118; notation:19, 21 |
| F10 | "At each edge, B adds the values of edges that continue forward from it … B is one step of accumulation, not a sum along the whole downstream chain. A terminal edge accumulates nothing. No boundary is closed to supply continuation that was not declared." | plain:164-169; notation:23 |
| F11 | "At each edge, R adds the difference between what continues forward and what arrives from behind, scaled by local contrast." R(g)[e] = g[e] + ρ[e]·(Σ_succ(e) g − Σ_pred(e) g). | plain:181; notation:25 |
| F12 | "Σ is R applied directly to Δ(x) without prior B accumulation." Σ(g)[e] = g[e] + ρ[e]·(Σ_adj⁺(e) g − Σ_adj⁻(e) g), immediate neighbours only. "E_primary = Σ(Δ(x))." | notation:27; plain:122-126 |
| F13 | ρ[i] = ρ_base·χ[i]/(χ₀ + χ[i]), with χ[i] "the maximum of \|A(x)[e]\| or \|Δ(x)[e]\| over all edges incident to i", and ρ[e] := ρ[source(e)]. "The kernel supplies no value for either." "χ₀ must be finite and positive." The max selection and the saturating form are OPEN. | notation:29; plain:195; ref:420, 425-428 |
| F14 | "Where M establishes at least one interior locus, the full kernel A → B → R applies." "The minimal admissible interior is: s → t → u." Otherwise "the primary kernel Δ → Σ is the correct kernel" and "B is not evaluated." "The condition is structural, not a number reached by a ratio." | plain:134-142; notation:53-57; ref:384-395 |
| F15 | "Any reduction of the field — to one value per node, to a bound, to a variance — is a projection. A projection is admissible when what it preserves and what it discards are stated." "No silent reduction." | plain:205-208; notation:17, 31 |
| F16 | "Admissible before Δ or A: uniform shift, declared unit scale." | plain:216; notation:33 |
| F17 | "Phase 1 acts on one declared observation M(o)." Phase 2 needs a declared pair; "at the first declared observation … Only Phase 1 runs." "Phase 2 requires the process, not the photograph." | plain:51, 57, 231-237; notation:7 |
| F18 | "The direction is a property of the process — not a property of the index used to label the steps." "Temporal ordering is not the primitive." | plain:89, 95; notation:15 |
| F19 | The edge provenance classes are `Continuation`, `Coupling` and `Persistence`. | ref:330-337 |
| F20 | Origin "declares D, M, the relations and their provenance … Holds responsibility." "Generator proposes." The Verifier "detects divergence … Returns located findings, not approval." "The operators hold no agency." | ref:171-175, 131; roles:29-35, 180 |
| F21 | "The result is not an interpretation. It is a function of the declaration and the observable. Change the declaration and the result changes." "The operators do not interpret findings … do not determine what constitutes a significant result." | plain:239-241, 262-264 |
| F22 | "The operators produce the same classes of output … at every declared region from Primary through Planetary. What changes across regions is the declared measurement mapping M, not the operators or their constraints." The regions are Primary, Atomic, Molecular, Biological and Planetary. | README:20-23; ovs:520, 549, 579, 611, 641 |
| F23 | "`cargo test` on `main` runs 61 library tests … and 3 `provenance_demo` tests." On `kernel-v9` it "also runs 31 additional conformance tests … (4 further tests are `#[ignore]` pending V9 enforcement milestones)." | README:81-87 |
| F24 | RPPI: "Every admitted value, operation, and result must have a continuous, verifiable provenance path to an Origin-declared observable relation within D." It keeps three things distinct: a provenance label, a declaration record and a calculation record. Milestones 1–3 are complete ("Verifier accepted 2026-10-24"). The enforcement types are OPEN. "V8 constructors and operators are unchanged (Req-5)." There are seven requirements, Req-1 to Req-7, and four failure modes: missing, fabricated, disconnected and misattributed. The type names are "(working name)". | README:37-66, 290-326; spec:13-22, 90-111, 124-134, 333, 356-414 |
| F25 | Lineage. V5: persistence edges. V6: "Primary kernel E_primary = Σ(Δ(x)); ring inadmissibility derived". V7: unified file and the sequential-observation requirement. V7 (purge): SVD and rank quantities removed. V7.1: "ρ_base, χ₀, cc M-supplied; no kernel defaults". Kernel V8 (2026-09-26): one release across every file, with the cold start removed. Kernel V9 (2026-10-24): the foundational primitive stated. Earlier labels are "document-local, not kernel release versions". | ref:1119-1136; README:93-95, 332-334, 355; plain:280 |
| F26 | The repository lists these as open or held: A-3 empty adjacency (OPEN); the ρ max-selection rule and the saturating form (OPEN); `are_proportional` edge-order dependence (HOLD). | ref:1031, 1034-1036 |
| F27 | Title as above. The paper surveys "between six and twelve disciplines (depending on classification criteria) where researchers derived functionally corresponding measures of correlation scaling, with little documented awareness of each other's work." | MAIN:39, 63; README:7 |
| F28 | "Researchers in at least six different fields invented essentially the same mathematics for this purpose, over nine decades, mostly without knowing about each other's work. A physicist measuring 'correlation length,' a cardiologist computing a 'DFA scaling exponent,' a financial analyst calculating a 'Hurst exponent,' and a machine learning engineer tuning a 'spectral radius' are all answering the same question: how close is this system to a critical transition?" | MAIN:80 |
| F29 | The `tab:equiv` rows, verbatim (the `ROWS` array in `index.html`). The HRV note: "Healthy cardiac dynamics operate *away from* criticality (α₁ ≈ 0.75); values of α₁ ≈ 1.0 indicate pathological loss of autonomic regulation." Categories: "ξ and τ are diverging correlation measures; α and H are global scaling exponents; χ is a local linear stability condition; ρ_c is a threshold parameter"; b, γ and β are "empirical scaling exponents from power-law distributions rather than correlation-decay diagnostics". | MAIN:375-386, 392, 394 |
| F30 | "We use 'functional correspondence' rather than 'mathematical equivalence'." For fGn, "α = H". For fBm, "α = H + 1, but remains exact and well-defined." "We do not claim this equivalence generalizes beyond the fGn/fBm family." "All answer the same question: how far do correlations extend?" | MAIN:394, 399, 406, 408 |
| F31 | The classification table (`tab:classification`), 15 rows, Domain · Classification, verbatim. "Six domains — Kauffman's edge of chaos, biomedical signal analysis, neuroscience, machine learning, power grid analysis, and traffic flow (Kerner) — present the clearest cases for independent development, though with qualifications noted for each." The category definitions are at MAIN:121-125 and "qualified" at MAIN:128. | MAIN:140-154, 161, 121-128 |
| F32 | "The functional correspondence we document is phenomenological." "Our citation analysis cannot rule out informal knowledge transfer. The quantitative evidence supports but does not prove independent derivation." | MAIN:481, 483 |
| F33 | Phase 5 (Gate A/B fixes). The preprint's answer to the standard view: the fields worked "mostly without knowing about each other's work" (MAIN:80); some cases are domain transfers with traceable lineage (MAIN:161, tab:classification); "the mathematics is dictated by the structure of the problem", "not coincidental" (MAIN:410). The page paraphrases this and does not quote the word MAIN:410 uses for the pattern. Also: "The kernel is domain and scale invariant" (README:20). Σ is R applied to Δ (notation:27). The supplement's A is x[i] − mean(x) (SUPP:35); C is a declared projection, not a kernel operator (notation:31). Milestone 1 has no recorded acceptance; Milestones 2 and 3 say "Verifier accepted 2026-10-24" (README:305, 312). No source states the paper's licence, so the footer drops it. | MAIN:80, 161, 410; README:20, 305, 312; notation:27, 31; SUPP:35, 54-58 |
| F34 | Phase 6 (gate fixes round 2). No kernel file mentions criticality, so the page offers the kernel as a footing for the question and says the answer is still to be shown field by field. The README's "regions" are declared scales (Primary through Planetary), not fields (README:20-23). Toggle answer: "mostly without knowing about each other's work" (MAIN:80), qualifications per case (MAIN:161), "not coincidental … dictated by the structure of the problem" (MAIN:410). ρ route: ρ[i] = ρ_base · χ[i] / (χ₀ + χ[i]), "χ[i] the largest absolute directed difference at node i — the maximum of \|A(x)[e]\| or \|Δ(x)[e]\| over all edges incident to i"; ρ[e] := ρ[source(e)] (notation:29). Demo check: x = (3, 1, 0), ρ_base 0.5, χ₀ 1: χ = 2 at points 0 and 1, so ρ = 0.5·2/3 = 0.333 on both arrows. χ is a largest difference, not a count of arrows. | README:20-23; MAIN:80, 161, 410; notation:29 |
| F35 | Credit (A1, corrected in A2). "Copyright 2026 Metatron Dynamics, Inc." (LICENSE:1); "**Metatron Dynamics, Inc.** relationalrelativity.dev" (README:3); Apache-2.0 (LICENSE:3). Who wrote the kernel: "The Origin (Robin Macomber)" (proto:87); "Macomber independently derived a set of discrete operators" (SUPP:120); CRediT "RM (Methodology, Software …)" (MAIN:42). Preprint authors Bruce Stephenson and Robin Macomber (MAIN, author block). Pinned commit `af5fd6f`, 2026-10-24 (`git log -1 origin/kernel-v9`); crate `abr-kernel` 8.0.0 (Cargo.toml:3). The A1 entry said no source states who wrote the kernel; that was wrong. The page does not carry README:546 or the local path at proto:90. proto = `docs/process/repository_protocol_v1.md`. | LICENSE:1, 3; README:3; proto:87; SUPP:120; MAIN:42; Cargo.toml:3 |
| F36 | Gloss of "declared" (A2.7), "What it is". Stated by Origin, the person responsible: "**Origin** — declaration and responsibility: declares D, M, the relations and their provenance, and what is admissible" (roles:31); "Origin is held by the human" (roles:35). Before any operator acts: "M : O → D, declared before anything is taken" (notation:7). Traced through M: "every quantity in it can be traced to an observable through M" (notation:5); a declared relation is a spatial edge or persistence relation (notation:9). Never supplied by the calculation: "no continuation, predecessor, successor, boundary closure, or operator result may be supplied by the mathematics itself" (notation:61). The A2.6 gloss ("written down beforehand by the person applying it, not inferred from the data") was wrong and is replaced. | notation:5, 7, 9, 61; roles:31, 35 |

**Supplement and lineage (the accordion "Where it's from").** SUPP:27-30 names the framework and defines
four operators A, B, R and C, composed into E, "with circular boundary conditions". A is x[i] − mean(x)
(SUPP:35), B and R use `mod n` (SUPP:42, 49), C is x/(1+|x|) (SUPP:56), and E = C(R(B(A(x)))) (SUPP:63).
SUPP:120: "[The framework] originated in distributed systems engineering. Macomber independently derived a
set of discrete operators for analyzing relational structure in computational networks. When Stephenson
evaluated the framework in 2024, the operators' behavior at parameter boundaries … resembled critical phase
transitions in statistical physics. … Our framework is not the paper's thesis; it is the accident that
revealed the thesis." MAIN:113: "Our investigation was prompted by a specific case of apparent
independent derivation (see Supplementary Material)". MAIN:65 and SUPP:126 exclude the framework from the
survey count.

---

## Demo check (Interactive 1)

The fixture is nodes 0, 1, 2 with edges e0 = (0→1) and e1 = (1→2), both Continuation (conf:57-64).
The test parameters are ρ_base = 0.5 and χ₀ = 1.0 (conf:122). These are fixture values, not kernel
defaults. `cargo` is not installed on the build machine, so every row below was checked by hand against
the source:

- A: `x[s] − x[t]` (ops:967-976; Δ at ops:648-657).
- B: `s[e] + Σ succ(e)` (ops:987-999).
- ρ (ABR): χ is the max over out- and in-edges at node i, and ρ[e] = ρ[src(e)] (ops:1015-1025, 1052).
- ρ (primary): χ is taken over the edges incident to the source of e (ops:716-734).
- R: `bg[e] + ρ_e·(fwd − bwd)` (ops:1054-1060); no component pairs are declared, so there is no cc term (ops:1062-1063).
- Σ: as R, with adj⁺ and adj⁻ over Δ (ops:775-794).

| input | A | B | ρ (e0, e1) | R | Σ (interior off) |
|---|---|---|---|---|---|
| x=[3,1,0], 0.5, 1.0 | [2, 1] | [3, 1] | [1/3, 1/3] | [3.333, 0.000] | [2.333, 0.333] |
| x=[0,1,3] | [−1, −2] | [−3, −2] | [0.25, 1/3] | [−3.500, −1.000] | [−1.500, −1.667] |
| x=[4,2,1] | as row 1 | as row 1 | as row 1 | as row 1 | as row 1 |
| χ₀ = 5 | [2, 1] | [3, 1] | [0.142857, 0.142857] | [3.142857, 0.571429] | — |
| ρ_base = 0 | [2, 1] | [3, 1] | [0, 0] | [3, 1] | [2, 1] |

## Corrections to the plan's line numbers (reported, not silently fixed)

- RPPI is at README:37-66, not 34-62. The crate name is at README:335, not 336-337.
- "Operators unchanged" is at README:325-326. The test counts are at README:81-87.
- "prompted" is at MAIN:113, not SUPP:120. SUPP:120 itself says "originated … evaluated … in 2024 … resembled".
- The `tab:equiv` rows are at MAIN:375-386, the HRV note at 392 and the categories at 394.
- The physics and seismology rows of `tab:classification` are at MAIN:140-141, and the full table at 140-154.
- The paper calls the SOC row "Intra-physics extension" (MAIN:142). Its definition list says "Intra-field extension" (MAIN:123).
- The repository's own README title adds ": A Cross-Domain Analysis" (paper `README.md:3`). The page uses the `.tex` title (MAIN:39).
- The three-node fixture is at conf:57-64.
