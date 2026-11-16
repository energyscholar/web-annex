#!/usr/bin/env python3
"""
ride-build.py — write the parts of the line that are derived from docs/ride/stations.json.

  python3 scripts/ride-build.py           # rewrite the derived parts
  python3 scripts/ride-build.py --check   # exit 1 if any derived part is out of date; write nothing

Derived parts (each between its own markers, or the whole file):
  docs/ride/index.html   the station list, the spur list and the axis legend, as static markup, so a
                         reader without scripts and the conform.py probes see every link the page offers
  docs/js/station-data.js  the station table that js/station-nav.js reads on expert pages
  docs/art/thumbnails/ride.svg  the landing page's small picture of the line (window view, no script)
  every expert page and spur page: three marked blocks, the stylesheet link at the end of <head>, the
                         hatch (R2) directly after <body>, and the station nav with its two scripts just
                         before </body>; nothing else on the page is touched

stations.json is the one source of truth; never hand-edit a derived part.
"""
import argparse, html, json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(HERE, "docs")
BEGIN = "<!-- BEGIN STATIONS: written by scripts/ride-build.py from ride/stations.json, do not hand-edit -->"
END = "<!-- END STATIONS -->"
E = html.escape

STATE_NOTE = {
    "coming": "Coming: this station has no page yet.",
    "held": "Held: this station's page waits on a check before it is written.",
}


def href_from_ride(path):
    """A docs-relative page path as a link from docs/ride/index.html."""
    if path.endswith("/index.html"):
        path = path[: -len("index.html")]
    return "../" + path


def tip(name, gloss):
    return (f'<span class="tip" tabindex="0">{E(name)}<span class="tt">{E(gloss)}</span></span>')


def switch(path, label):
    return f'<a class="switch" data-switch="expert" href="{E(href_from_ride(path))}">{E(label)}</a>'


def station_block(s):
    sid = s["id"]
    num = "T" if sid == "T" else sid
    L = [f'<li class="station" id="station-{sid}" data-station="{sid}" data-state="{s["state"]}" '
         f'data-x="{s["map"]["x"]}" data-y="{s["map"]["y"]}" data-c="{s["c"]}">',
         f'  <h3><span class="num">{num}</span> {E(s["title"])}</h3>',
         f'  <p class="view">Out of the window: {E(s["view"])}.</p>',
         f'  <p class="carry">Take away: <strong>{E(s["carry"]["picture"])}</strong> &middot; '
         + tip(s["carry"]["name"], s["carry"]["gloss"]) + "</p>",
         f'  <p class="phase" data-layer="map">On the map: {E(s["phase"])}.</p>']
    if s["state"] in STATE_NOTE:
        L.append(f'  <p class="state">{STATE_NOTE[s["state"]]}</p>')
    if s.get("start"):
        L.append(f'  <p class="ride-on"><a href="{E(href_from_ride(s["start"]))}">Ride this station: the easy version</a></p>')
    go = []
    if s.get("expert"):
        go.append(switch(s["expert"], f'Go deeper: the physics version of station {num}, {s["expert_title"]}'))
    for p in s.get("also") or []:
        go.append(switch(p, f'Go deeper: also at station {num}, {title_of(p)}'))
    if go:
        L.append('  <p class="go">' + "<br>".join(go) + "</p>")
    L.append("</li>")
    return "\n".join(L)


_titles = {}


def title_of(p):
    return _titles.get(p, p)


def spur_block(spurs):
    lines = {}
    for sp in spurs:
        lines.setdefault(sp["line"], {"title": sp["line_title"], "from": sp["from"], "pages": []})["pages"].append(sp)
    L = ['<ul class="spurs">']
    for key, ln in lines.items():
        L.append(f'<li id="spur-{key}"><h3>{E(ln["title"])}</h3>'
                 f'<p>A branch line from station {E(ln["from"])}: <a href="#station-{E(ln["from"])}">back to the line</a>.</p>'
                 '<p class="go">' + "<br>".join(switch(sp["expert"], f'Go deeper: side trip, {sp["title"]}')
                                                for sp in ln["pages"]) + "</p></li>")
    L.append("</ul>")
    return "\n".join(L)


def axes_block(axes):
    names = {"x": "across", "y": "into the picture", "z": "up"}
    L = ['<dl class="axes" data-layer="map">']
    for k in ("x", "y", "z"):
        a = axes[k]
        L.append(f'<dt>{names[k]}</dt><dd id="axis-{k}" data-axis="{k}">'
                 + tip(a["name"], a["name"] + "; " + a["meaning"]) + "</dd>")
    L.append("</dl>")
    return "\n".join(L)


MARK = "written by scripts/ride-build.py from ride/stations.json, do not hand-edit"
HATCH = "back to the easy version"


def rel(page, target):
    """A docs-relative target as a link from the docs-relative page."""
    up = "../" * page.count("/")
    if target.endswith("/index.html"):
        target = target[: -len("index.html")]
    return up + target


def line_pages(st):
    """(page, station row, spur row or None) for every expert, also and spur page, in station order."""
    by_id = {s["id"]: s for s in st["stations"]}
    out = []
    for s in st["stations"]:
        for p in ([s["expert"]] if s.get("expert") else []) + list(s.get("also") or []):
            out.append((p, s, None))
    for sp in st["spurs"]:
        out.append((sp["expert"], by_id[sp["from"]], sp))
    return out


def hatch_href(page, s):
    if s.get("start"):
        return rel(page, s["start"])
    return rel(page, "ride/index.html") + "#station-" + s["id"]


def blocks(page, s, sp):
    sid = s["id"]
    head = (f"<!-- BEGIN NAVCSS: {MARK} -->\n"
            f'<link rel="stylesheet" href="{rel(page, "css/station-nav.css")}">\n<!-- END NAVCSS -->')
    hatch = (f"<!-- BEGIN HATCH: {MARK} -->\n"
             f'<a class="hatch" data-station="{sid}" href="{E(hatch_href(page, s))}">{HATCH}</a>\n<!-- END HATCH -->')
    ride = rel(page, "ride/index.html")
    if sp is None:
        nav = (f'<nav class="station-nav" data-station="{sid}" aria-label="The line">'
               f'<span class="here"><a data-line href="{E(ride)}#station-{sid}">station {sid} on the line</a></span></nav>\n'
               f'<script src="{rel(page, "js/station-data.js")}"></script>\n'
               f'<script src="{rel(page, "js/station-nav.js")}"></script>')
    else:
        nav = (f'<nav class="station-nav" data-spur="{sid}" aria-label="The line">'
               f'<span class="here"><a data-line href="{E(ride)}#spur-{E(sp["line"])}">back to the line</a></span></nav>')
    foot = f"<!-- BEGIN LINE: {MARK} -->\n{nav}\n<!-- END LINE -->"
    return head, hatch, foot


def place(text, name, block, anchor):
    """Put block between its markers, or, the first time, at anchor(text) -> index."""
    b, e = f"<!-- BEGIN {name}:", f"<!-- END {name} -->"
    if b in text:
        i = text.index(b); j = text.index(e, i) + len(e)
        return text[:i] + block + text[j:]
    k = anchor(text)
    return text[:k] + block + "\n" + text[k:]


def after_body(t):
    m = re.search(r"<body\b[^>]*>\n?", t, re.I)
    return m.end()


def before_head_end(t):
    return re.search(r"</head>", t, re.I).start()


def before_body_end(t):
    return t.lower().rindex("</body>")


def thumbnail(st):
    """A static window-view picture of the line: hills, the track at each station's level, stations."""
    W, H, X0, X1, G, HP, w = 600, 170, 24, 576, 160, 118, 0.028
    xs = [s["map"]["x"] for s in st["stations"]]
    along = lambda x: max(1 / (1 + ((x - xi) / w) ** 2) for xi in xs)
    px = lambda x: X0 + x * (X1 - X0)
    py = lambda h: G - h * HP
    hill = " ".join(f"L {px(i / 300):.1f} {py(along(i / 300)):.1f}" for i in range(301))
    c = st["stations"][0]["c"]
    dots = []
    for s in st["stations"]:
        fill = "#f1f5f9" if s["state"] == "live" else "#13203a"
        dash = "" if s["state"] == "live" else ' stroke-dasharray="2 2"'
        dots.append(f'<circle cx="{px(s["map"]["x"]):.1f}" cy="{py(s["c"]) - 1:.1f}" r="5" fill="{fill}" '
                    f'stroke="#f1f5f9" stroke-width="1.5"{dash}/>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 170" role="img" aria-labelledby="t">\n'
            '<title id="t">The ride: a monorail across a row of hills, one station on each hilltop</title>\n'
            '<!-- written by scripts/ride-build.py from ride/stations.json, do not hand-edit -->\n'
            f'<rect width="{W}" height="{H}" fill="#13203a"/>\n'
            f'<path d="M {X0} {G} {hill} L {X1} {G} Z" fill="#1f3b2f" stroke="#3f7a5c" stroke-width="1.2"/>\n'
            f'<path d="M {X0} {py(c):.1f} L {X1} {py(c):.1f}" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>\n'
            + "\n".join(dots) + "\n</svg>\n")


def build(st):
    for s in st["stations"]:
        if s.get("expert"):
            _titles[s["expert"]] = s["expert_title"]
    for sp in st["spurs"]:
        _titles[sp["expert"]] = sp["title"]
    _titles.update({
        "physical-systems-chart/index.html": "the physical-systems chart",
        "diamond-node/critical-lines/models/index.html": "the models",
        "diamond-node/critical-lines/techniques/index.html": "the techniques",
        "poised-state-chlorophyll/index.html": "The Poised Antenna",
    })
    block = [BEGIN, axes_block(st["axes"]), '<ol class="stations">']
    block += [station_block(s) for s in st["stations"]]
    block += ["</ol>", '<h2 id="spurs">Side trips</h2>',
              "<p>Branch lines leave the main line at a station. They go straight to the full pages, "
              "so each one is a switch.</p>", spur_block(st["spurs"]), END]
    return "\n".join(block)


def station_data(st):
    rows = [{"id": s["id"], "title": s["title"], "expert": s["expert"], "start": s["start"], "state": s["state"]}
            for s in st["stations"]]
    return ("/* station-data.js: written by scripts/ride-build.py from ride/stations.json, do not hand-edit. */\n"
            "window.RIDE_STATIONS = " + json.dumps(rows, ensure_ascii=False, indent=1) + ";\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    st = json.load(open(os.path.join(DOCS, "ride", "stations.json"), encoding="utf-8"))
    stale = []

    ride = os.path.join(DOCS, "ride", "index.html")
    s = open(ride, encoding="utf-8").read()
    new = s[: s.index(BEGIN)] + build(st) + s[s.index(END) + len(END):]
    if new != s:
        stale.append("docs/ride/index.html")
        if not a.check:
            open(ride, "w", encoding="utf-8").write(new)

    data = os.path.join(DOCS, "js", "station-data.js")
    want = station_data(st)
    if not os.path.exists(data) or open(data, encoding="utf-8").read() != want:
        stale.append("docs/js/station-data.js")
        if not a.check:
            open(data, "w", encoding="utf-8").write(want)

    thumb = os.path.join(DOCS, "art", "thumbnails", "ride.svg")
    want = thumbnail(st)
    if not os.path.exists(thumb) or open(thumb, encoding="utf-8").read() != want:
        stale.append("docs/art/thumbnails/ride.svg")
        if not a.check:
            open(thumb, "w", encoding="utf-8").write(want)

    for page, srow, sp in line_pages(st):
        f = os.path.join(DOCS, page)
        t = open(f, encoding="utf-8").read()
        head, hatch, foot = blocks(page, srow, sp)
        n = place(t, "NAVCSS", head, before_head_end)
        n = place(n, "HATCH", hatch, after_body)
        n = place(n, "LINE", foot, before_body_end)
        if n != t:
            stale.append("docs/" + page)
            if not a.check:
                open(f, "w", encoding="utf-8").write(n)

    print(("stale: " if a.check else "rewrote: ") + (", ".join(stale) if stale else "nothing"))
    sys.exit(1 if (a.check and stale) else 0)


if __name__ == "__main__":
    main()
