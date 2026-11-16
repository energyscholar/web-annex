#!/usr/bin/env python3
"""
conform.py — score every page against the station contract (STANDARD.md).

  python3 scripts/conform.py                              # score docs/, print the summary
  python3 scripts/conform.py --gate H,N                   # exit 1 if any page misses an H- or N-clause
  python3 scripts/conform.py --gate S --only ride/        # exit 1 if any file under ride/ misses an S-clause
  python3 scripts/conform.py --page kosterlitz-thouless/index.html   # one page, clause by clause
  python3 scripts/conform.py --opsec-patterns FILE --book-terms FILE  # also run the safety probes

Every clause has a mechanical probe over the page source (no browser). A clause that applies to a
page is either met or missed; one that does not apply is neither. Safety clauses (X) are reported
but never change a tier. The pattern lists for X1 and X2 are read from files given on the command
line and are never stored in this repository.

Page roles come from docs/ride/stations.json and scripts/tracks.json:
  expert     a station's expert or also page                 E1-E7, N1, H1-H5
  spur       a spur page                                      E1-E7, N2, H1-H5
  start      a station's start/index.html (beginner)          E1, E2, B1-B6, S1-S5
  surface    docs/index.html and every page under ride/       E1, E2, S1-S3, S5
  science    any other science-track page                     E1-E7
  how-we-work                                                  W1-W3
The game tree is pruned by prefix before the walk: its files are never listed, opened or scored.

Writes (unless --no-manifest) a "clauses missed most" block into TUTORIAL-MANIFEST.md between its
own markers; the rest of that file is left untouched.
"""
import argparse, fnmatch, json, os, re, sys
from collections import Counter
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_PREFIXES = ("https://energyscholar.github.io/web-annex/", "http://energyscholar.github.io/web-annex/")
GUARD_MARK = "PHYSICS EDITORIAL STANDARD"
HATCH_TEXT = "back to the easy version"
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
CORE = {"E1", "E2", "H1", "H2", "H3", "H4", "H5", "N1", "N2", "S1", "S2", "S3", "S4", "S5"}
BEGIN = "<!-- BEGIN CONFORMANCE — edited by scripts/conform.py, do not hand-edit -->"
END = "<!-- END CONFORMANCE -->"

CLAUSES = {
    "E1": "a meta description",
    "E2": "a <title> of at most 70 characters",
    "E3": "at least five tooltips (class=\"tip\")",
    "E4": "at least one DOI",
    "E5": "the physics editorial standard mark",
    "E6": "three-depth accordions (an l1 and an l2 <details>, or 'Working equations' and 'Full derivation'), none open by default",
    "E7": "any animation has a play/pause control",
    "N1": "a static <nav class=\"station-nav\" data-station> for this station, linking the ride map, with js/station-nav.js loaded",
    "N2": "a static <nav class=\"station-nav\" data-spur> with a 'back to the line' link to the ride map",
    "H1": "a static <a class=\"hatch\"> in the markup",
    "H2": "the hatch names this page's station and leads to that station's beginner surface",
    "H3": "the hatch is a child of <body> and comes before the first <h1> and <main>",
    "H4": "css/station-nav.css gives .hatch position: sticky, and the page links that stylesheet",
    "H5": "the hatch is a plain link reading 'back to the easy version'",
    "B1": "at most 900 words",
    "B2": "arithmetic only: no equation markup, no calculus symbols",
    "B3": "exactly one interactive (data-interactive)",
    "B4": "exactly three quiz items (data-quiz-item)",
    "B5": "named things tooltipped (at least one class=\"tip\")",
    "B6": "a static station nav for this station",
    "S1": "every link to an expert page is a switch (data-switch=\"expert\")",
    "S2": "every switch is a link to an expert page whose text starts 'Go deeper' and names the destination after a colon",
    "S3": "no redirect: no meta refresh, no script that sets location or opens a window",
    "S4": "exactly one switch, to this station's own expert page",
    "S5": "no script loaded here reads a station's expert or also path",
    "W1": "a meta description",
    "W2": "a link back to the site (a parent directory or the landing page)",
    "W3": "at least one tooltip",
    "X1": "no match against the OPSEC pattern list (file given by --opsec-patterns)",
    "X2": "no match against the book terms (file given by --book-terms)",
}
ROLE_CLAUSES = {
    "expert": ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "N1", "H1", "H2", "H3", "H4", "H5"],
    "spur": ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "N2", "H1", "H2", "H3", "H4", "H5"],
    "start": ["E1", "E2", "B1", "B2", "B3", "B4", "B5", "B6", "S1", "S2", "S3", "S4", "S5"],
    "surface": ["E1", "E2", "S1", "S2", "S3", "S5"],
    "science": ["E1", "E2", "E3", "E4", "E5", "E6", "E7"],
    "how-we-work": ["W1", "W2", "W3"],
}


class Page(HTMLParser):
    """One pass over the source: the elements we probe, in document order, with their parent tag."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.els, self.text, self.scripts_inline = [], [], [], []
        self.title, self._in = "", None
        self.open = []

    def handle_starttag(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        el = {"tag": tag, "attrs": a, "i": len(self.els), "parent": self.stack[-1] if self.stack else None,
              "text": ""}
        self.els.append(el)
        if tag in ("script", "style", "title"):
            self._in = tag
        if tag not in VOID:
            self.stack.append(tag)
            self.open.append(el)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1] == tag:
            self.stack.pop()
            self.open.pop()

    def handle_endtag(self, tag):
        if tag == self._in:
            self._in = None
        if tag in self.stack:
            while self.stack:
                self.open.pop()
                if self.stack.pop() == tag:
                    break

    def handle_data(self, d):
        if self._in == "script":
            self.scripts_inline.append(d)
        elif self._in == "title":
            self.title += d
        elif self._in != "style":
            self.text.append(d)
            for el in self.open:
                if el["tag"] in ("a", "button", "summary"):
                    el["text"] += d


def classes(el):
    return el["attrs"].get("class", "").split()


class Site:
    def __init__(self, root, stations_path, tracks_path, nav_css):
        self.root = root
        st = json.load(open(stations_path, encoding="utf-8"))
        tr = json.load(open(tracks_path, encoding="utf-8"))
        self.game = tr.get("game_prefixes", [])
        self.track = {p: t for t, ps in tr.get("tracks", {}).items() for p in ps}
        self.station_of, self.role = {}, {}
        self.stations = {s["id"]: s for s in st.get("stations", [])}
        for s in st.get("stations", []):
            for p in [s.get("expert")] + list(s.get("also") or []):
                if p:
                    self.role[p], self.station_of[p] = "expert", s["id"]
            if s.get("start"):
                self.role[s["start"]], self.station_of[s["start"]] = "start", s["id"]
        for sp in st.get("spurs", []):
            self.role[sp["expert"]], self.station_of[sp["expert"]] = "spur", sp["from"]
        self.expert_pages = {p for p, r in self.role.items() if r in ("expert", "spur")}
        self.nav_css = nav_css or os.path.join(root, "css", "station-nav.css")

    def pages(self):
        out = []
        for d, dirs, files in os.walk(self.root):
            rel = os.path.relpath(d, self.root).replace(os.sep, "/")
            rel = "" if rel == "." else rel + "/"
            dirs[:] = sorted(x for x in dirs if not x.startswith(".")
                             and not any(fnmatch.fnmatch(rel + x + "/", g) for g in self.game))
            out += [rel + f for f in files if f.endswith(".html")]
        return sorted(out)

    def role_of(self, p):
        if p in self.role:
            return self.role[p]
        if p == "index.html" or p.startswith("ride/"):
            return "surface"
        return "how-we-work" if self.track.get(p) == "how-we-work" else "science"

    def resolve(self, page, href):
        """A link's target as a docs-relative file path plus fragment, or (None, None) if off-site."""
        if not href or href.startswith(("mailto:", "javascript:", "data:", "tel:")):
            return None, None
        for pre in SITE_PREFIXES:
            if href.startswith(pre):
                href = "/" + href[len(pre):]
                page = ""
        base = "https://site.invalid/" + page
        u = urlsplit(urljoin(base, href))
        if u.netloc != "site.invalid":
            return None, None
        path = u.path.lstrip("/")
        if path == "" or path.endswith("/"):
            path += "index.html"
        elif not path.endswith(".html") and os.path.isdir(os.path.join(self.root, path)):
            path += "/index.html"
        return path, u.fragment

    def local_script(self, page, src):
        path, _ = self.resolve(page, src)
        if path and os.path.isfile(os.path.join(self.root, path)):
            return path, open(os.path.join(self.root, path), encoding="utf-8", errors="replace").read()
        return path, None


def probe(site, path, raw, opsec, book):
    pg = Page()
    pg.feed(raw)
    els = pg.els
    role = site.role_of(path)
    sid = site.station_of.get(path)
    station = site.stations.get(sid) if sid else None
    body_text = " ".join(pg.text)
    scripts = [(e, site.local_script(path, e["attrs"]["src"])) for e in els
               if e["tag"] == "script" and e["attrs"].get("src")]
    script_src = "\n".join(pg.scripts_inline) + "\n" + "\n".join(t for _, (_, t) in scripts if t)
    links = [e for e in els if e["tag"] == "a" and "href" in e["attrs"]]
    first_head = next((e["i"] for e in els if e["tag"] in ("h1", "main")), None)
    hatches = [e for e in links if "hatch" in classes(e)]
    switches = [e for e in els if e["attrs"].get("data-switch") == "expert"]

    def beginner_target(s):
        if s.get("start"):
            return s["start"], ""
        return "ride/index.html", "station-" + s["id"]

    R = {}
    R["E1"] = bool(re.search(r'<meta\s+name=["\']description["\']\s+content=["\']\s*\S', raw, re.I))
    t = re.sub(r"\s+", " ", pg.title).strip()
    R["E2"] = 0 < len(t) <= 70
    R["E3"] = sum(1 for e in els if "tip" in classes(e)) >= 5
    R["E4"] = bool(re.search(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", body_text + raw))
    R["E5"] = GUARD_MARK in raw
    det = [e for e in els if e["tag"] == "details"]
    summ = " ".join(e["text"] for e in els if e["tag"] == "summary").lower()
    depths = ({"l1", "l2"} <= {c for e in det for c in classes(e)}) or \
             ("working equations" in summ and "full derivation" in summ)
    R["E6"] = depths and not any("open" in e["attrs"] for e in det)
    animated = bool(re.search(r"requestAnimationFrame|setInterval\s*\(", script_src))
    play = any(e["tag"] == "button" or e["attrs"].get("role") == "button" for e in els
               if re.search(r"\b(play|pause)\b", e["text"] + " " + e["attrs"].get("aria-label", "") + " "
                            + e["attrs"].get("title", ""), re.I))
    # a control the page's own scripts create counts: a 'Play' or 'Pause' label in a string literal
    play = play or bool(re.search(r"['\"`]\s*(?:[^'\"`]{0,3})(Play|Pause)\b", script_src))
    R["E7"] = (not animated) or play

    navs = [e for e in els if e["tag"] == "nav" and "station-nav" in classes(e)]
    loads_nav_js = any(sp and sp.endswith("js/station-nav.js") for _, (sp, _) in scripts)
    ride_links = [site.resolve(path, e["attrs"]["href"]) for e in links]
    links_ride = any(p == "ride/index.html" for p, _ in ride_links)
    R["N1"] = bool(sid) and any(e["attrs"].get("data-station") == sid for e in navs) and links_ride and loads_nav_js
    R["N2"] = bool(sid) and any(e["attrs"].get("data-spur") == sid for e in navs) and any(
        site.resolve(path, e["attrs"]["href"])[0] == "ride/index.html" and "back to the line" in e["text"].lower()
        for e in links)

    h = hatches[0] if hatches else None
    R["H1"] = h is not None
    if h is not None and station is not None:
        tp, tf = site.resolve(path, h["attrs"]["href"])
        R["H2"] = h["attrs"].get("data-station") == sid and (tp, tf or "") == beginner_target(station)
    else:
        R["H2"] = False
    R["H3"] = h is not None and h["parent"] == "body" and (first_head is None or h["i"] < first_head)
    css = open(site.nav_css, encoding="utf-8").read() if os.path.isfile(site.nav_css) else ""
    sticky = any("position:sticky" in re.sub(r"\s+", "", m.group(2))
                 for m in re.finditer(r"([^{}]*)\{([^}]*)\}", css) if re.search(r"\.hatch\b", m.group(1)))
    links_css = any(e["tag"] == "link" and "stylesheet" in e["attrs"].get("rel", "")
                    and (site.resolve(path, e["attrs"].get("href", ""))[0] or "").endswith("css/station-nav.css")
                    for e in els)
    R["H4"] = sticky and links_css
    R["H5"] = h is not None and re.sub(r"\s+", " ", h["text"]).strip().lower() == HATCH_TEXT and \
        not h["attrs"].get("role") and not any(e["tag"] == "dialog" for e in els)

    words = len(re.findall(r"[A-Za-z0-9']+", body_text))
    R["B1"] = words <= 900
    R["B2"] = not re.search(r"<math\b|\\\(|\\\[|\$\$|[∫∑∂∇]", raw)
    R["B3"] = sum(1 for e in els if "data-interactive" in e["attrs"]) == 1
    R["B4"] = sum(1 for e in els if "data-quiz-item" in e["attrs"]) == 3
    R["B5"] = any("tip" in classes(e) for e in els)
    R["B6"] = bool(sid) and any(e["attrs"].get("data-station") == sid for e in navs)

    targets = [(e, site.resolve(path, e["attrs"]["href"])[0]) for e in links]
    R["S1"] = all(e["attrs"].get("data-switch") == "expert" for e, tp in targets if tp in site.expert_pages)
    R["S2"] = all(e["tag"] == "a" and site.resolve(path, e["attrs"].get("href", ""))[0] in site.expert_pages
                  and re.match(r"\s*Go deeper\b[^:]*:\s*\S.{3,}", e["text"]) for e in switches)
    R["S3"] = not re.search(r'http-equiv=["\']?refresh', raw, re.I) and not re.search(
        r"\blocation\s*(\.\s*href\s*)?=(?!=)|location\s*\.\s*(assign|replace)\s*\(|window\s*\.\s*open\s*\(", script_src)
    own = station.get("expert") if station else None
    R["S4"] = len(switches) == 1 and own is not None and \
        site.resolve(path, switches[0]["attrs"].get("href", ""))[0] == own
    R["S5"] = not re.search(r"\.\s*(expert|also)\b|\[\s*['\"](expert|also)['\"]\s*\]",
                            "\n".join(t for _, (_, t) in scripts if t))

    R["W1"] = R["E1"]
    R["W2"] = any(tp is not None and (tp == "index.html" or
                  os.path.dirname(tp) != os.path.dirname(path) and path.startswith(os.path.dirname(tp)))
                  for _, tp in targets)
    R["W3"] = any("tip" in classes(e) for e in els)

    applicable = list(ROLE_CLAUSES[role])
    text_all = raw
    if opsec is not None:
        applicable.append("X1")
        # a diamond-node/ directory path is a public URL, not a red-line hit
        R["X1"] = not any(rx.search(re.sub(r"diamond-node/", "", text_all)) for rx in opsec)
    if book is not None:
        applicable.append("X2")
        R["X2"] = not any(rx.search(text_all) for rx in book)

    met = [c for c in applicable if R[c]]
    missed = [c for c in applicable if not R[c]]
    scored = [c for c in missed if not c.startswith("X")]
    if role == "how-we-work":
        tier = "current" if not scored else "ok" if len(scored) == 1 else "primitive"
    else:
        tier = "current" if not scored else "ok" if len(scored) <= 2 and not (set(scored) & CORE) else "primitive"
    return {"path": path, "track": site.track.get(path, "untracked"), "role": role, "station": sid,
            "clauses_met": met, "clauses_missed": missed, "tier": tier}


def load_patterns(path):
    if not path:
        return None
    pats = [l.rstrip("\n") for l in open(path, encoding="utf-8") if l.strip() and not l.startswith("#")]
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FutureWarning)
        return [re.compile(p, re.I) for p in pats]


def manifest_block(recs):
    c = Counter(m for r in recs for m in r["clauses_missed"])
    tiers = Counter((r["track"], r["tier"]) for r in recs)
    L = [BEGIN, "", f"### Station contract (STANDARD.md): {len(recs)} pages scored", "",
         "Tiers: " + " · ".join(f"{t} {k}: {n}" for (t, k), n in sorted(tiers.items())), "",
         "| Clause | Pages missing it | What it asks |", "|---|---:|---|"]
    for cl, n in c.most_common():
        L.append(f"| {cl} | {n} | {CLAUSES[cl]} |")
    L += ["", END]
    return "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(HERE, "docs"))
    ap.add_argument("--stations")
    ap.add_argument("--tracks", default=os.path.join(HERE, "scripts", "tracks.json"))
    ap.add_argument("--nav-css")
    ap.add_argument("--opsec-patterns")
    ap.add_argument("--book-terms")
    ap.add_argument("--json")
    ap.add_argument("--gate", help="comma-separated clause families or clauses, e.g. H,N or S1")
    ap.add_argument("--only", action="append", help="path prefix to restrict scoring (repeatable)")
    ap.add_argument("--page")
    ap.add_argument("--manifest", default=os.path.join(HERE, "TUTORIAL-MANIFEST.md"))
    ap.add_argument("--no-manifest", action="store_true")
    a = ap.parse_args()

    site = Site(a.root, a.stations or os.path.join(a.root, "ride", "stations.json"), a.tracks, a.nav_css)
    opsec, book = load_patterns(a.opsec_patterns), load_patterns(a.book_terms)
    pages = site.pages()
    if a.only:
        pages = [p for p in pages if any(p.startswith(o) for o in a.only)]
    if a.page:
        pages = [a.page]
    recs = [probe(site, p, open(os.path.join(a.root, p), encoding="utf-8", errors="replace").read(), opsec, book)
            for p in pages]

    if a.page:
        r = recs[0]
        print(f"{r['path']}  role={r['role']}  station={r['station']}  tier={r['tier']}")
        for cl in r["clauses_met"]:
            print(f"  met     {cl}  {CLAUSES[cl]}")
        for cl in r["clauses_missed"]:
            print(f"  MISSED  {cl}  {CLAUSES[cl]}")
    else:
        c = Counter(m for r in recs for m in r["clauses_missed"])
        print(f"conform: {len(recs)} pages · tiers " + ", ".join(
            f"{k} {n}" for k, n in sorted(Counter(r['tier'] for r in recs).items())))
        print("clauses missed most: " + ", ".join(f"{cl} {n}" for cl, n in c.most_common(8)))

    if a.json:
        json.dump(recs, open(a.json, "w"), indent=1)
    if not a.no_manifest and not a.page and not a.only and os.path.exists(a.manifest):
        s = open(a.manifest, encoding="utf-8").read()
        block = manifest_block(recs)
        s = (s[:s.index(BEGIN)] + block + s[s.index(END) + len(END):]) if (BEGIN in s and END in s) \
            else s.rstrip() + "\n\n" + block + "\n"
        open(a.manifest, "w", encoding="utf-8").write(s)

    if a.gate:
        want = [g.strip() for g in a.gate.split(",") if g.strip()]
        bad = [(r["path"], m) for r in recs for m in r["clauses_missed"]
               if any(m == g or (len(g) == 1 and m.startswith(g)) for g in want)]
        for p, m in bad:
            print(f"GATE MISS {m} {p}")
        print(f"gate {a.gate}: " + ("PASS" if not bad else f"FAIL ({len(bad)} misses)"))
        sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
