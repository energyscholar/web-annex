#!/usr/bin/env python3
"""
conform-selftest.py — conform.py against its fixtures. Every fixture says which clause it must
pass or fail; a probe that cannot fail on its fixture is not a probe.

  python3 scripts/conform-selftest.py        # exit 1 on any unmet expectation

Fixtures (scripts/fixtures/conform/site/):
  good/index.html        expert, every clause met                      -> tier current
  ok/index.html          expert, no DOI                                -> misses E4 only, tier ok
  primitive/index.html   expert, no meta, no hatch, no nav             -> tier primitive
  r2/index.html          expert, no a.hatch                            -> must fail H1
  r3/index.html          expert, hatch names a different station       -> must fail H2 (H1 met)
  r4/index.html          expert, hatch after the first <h1>            -> must fail H3 (H1, H2 met)
  good/start/index.html  beginner, the only expert link is the switch  -> passes S1 and S4 (r1)
  ok/start/index.html    beginner, a plain link to the expert page     -> must fail S1
  anim/index.html        expert, animated with no play/pause control   -> must fail E7
  hww/index.html         how-we-work, light standard met               -> tier current
  nosticky.css           a station-nav.css without position: sticky    -> good/index.html must fail H4
  a throwaway pattern file and terms file (written to a temp dir)      -> X1 and X2 must be able to fail
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures", "conform")
SITE = os.path.join(FIX, "site")
CONFORM = os.path.join(HERE, "conform.py")


def run(*extra):
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "out.json")
        cmd = [sys.executable, CONFORM, "--root", SITE, "--tracks", os.path.join(FIX, "tracks.json"),
               "--json", out, "--no-manifest", *extra]
        p = subprocess.run(cmd, capture_output=True, text=True)
        if not os.path.exists(out):
            print(p.stdout[-2000:], p.stderr[-2000:])
            return {}
        return {r["path"]: r for r in json.load(open(out))}


fails = []


def expect(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        fails.append(name)


def missed(r, path):
    return set(r.get(path, {}).get("clauses_missed", ["(no record)"]))


def met(r, path):
    return set(r.get(path, {}).get("clauses_met", []))


r = run()
expect("good/index.html tier current, nothing missed",
       r.get("good/index.html", {}).get("tier") == "current" and missed(r, "good/index.html") == set())
expect("ok/index.html misses E4 only, tier ok",
       missed(r, "ok/index.html") == {"E4"} and r["ok/index.html"].get("tier") == "ok")
expect("primitive/index.html tier primitive", r.get("primitive/index.html", {}).get("tier") == "primitive")
expect("r2: no hatch fails H1", "H1" in missed(r, "r2/index.html"))
expect("r3: wrong-station hatch fails H2, meets H1",
       "H2" in missed(r, "r3/index.html") and "H1" in met(r, "r3/index.html"))
expect("r4: hatch after <h1> fails H3, meets H1 and H2",
       "H3" in missed(r, "r4/index.html") and {"H1", "H2"} <= met(r, "r4/index.html"))
expect("r1: the switch-only beginner page meets S1 and S4",
       {"S1", "S4"} <= met(r, "good/start/index.html") and not ({"S1", "S4"} & missed(r, "good/start/index.html")))
expect("a beginner page linking the expert page outside the switch fails S1", "S1" in missed(r, "ok/start/index.html"))
expect("anim: an animation with no play/pause fails E7", "E7" in missed(r, "anim/index.html"))
expect("good/index.html (no animation) meets E7", "E7" in met(r, "good/index.html"))
expect("how-we-work fixture tier current", r.get("hww/index.html", {}).get("tier") == "current")
expect("good/index.html meets H4 with the sticky css", "H4" in met(r, "good/index.html"))

r2 = run("--nav-css", os.path.join(FIX, "nosticky.css"))
expect("H4: a station-nav.css without position: sticky fails H4", "H4" in missed(r2, "good/index.html"))

with tempfile.TemporaryDirectory() as td:
    pat = os.path.join(td, "pat.txt")
    terms = os.path.join(td, "terms.txt")
    open(pat, "w").write("fixture beginner\n")
    open(terms, "w").write("plus two\n")
    r3 = run("--opsec-patterns", pat, "--book-terms", terms)
expect("X1 fires on a page matching a pattern", "X1" in missed(r3, "good/start/index.html"))
expect("X1 met on a page that does not match", "X1" in met(r3, "good/index.html"))
expect("X2 fires on a page matching a book term", "X2" in missed(r3, "good/start/index.html"))
expect("safety clauses do not change the tier", r3.get("good/index.html", {}).get("tier") == "current")

print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
