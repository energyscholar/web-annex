#!/usr/bin/env python3
"""
check-stations.py — validate the line's two manifests against their schemas and against disk.

  python3 scripts/check-stations.py                       # docs/ride/stations.json + scripts/tracks.json
  python3 scripts/check-stations.py --stations FILE --tracks FILE --root DIR --glossary FILE

Checks, each printed as one line, exit 1 on any failure:
  schema    stations.json and tracks.json validate against their schemas (jsonschema)
  paths     every non-null expert / also / spur path exists under the docs root
  live      every live station names an expert page
  images    every station names an image and its alt text, and the image file exists under docs/ride/; an
            expert_image (the physics figure, one click away) has its expert_image_alt and its file exists
  gloss     carry.name is carry.terms joined by ", "; each station's glossary L1s and its carry.note, joined by
            "; ", give back its old carry.gloss word for word (scripts/fixtures/ride/carry-gloss-8943677.json)
  glossary  docs/ride/glossary.json validates against its schema; every carry.terms key, see_also key and
            jargon_extra "see" is a glossary key; every key has an L1 that opens with the key and a colon; the
            18 flagged terms (ride_gloss.L2_REQUIRED) have an L2; every term of a station with a "Go deeper"
            page has an L3 (plan 1564, ruling O5)
  jargon    in the built docs/ride/index.html, the FIRST occurrence of every jargon word (glossary keys and
            jargon_extra words; whole words, any case, longest first) in each block is a tooltip for its key:
            inside a .tip.gl with that data-term, or a carry .tip.terms that lists it. Blocks: each station card
            (station 0 with its ticket-hall section), About this map (.lede, the figure caption, .howto), Side
            trips (#spurs, its intro, ul.spurs), and every other text element on its own. Not scanned: tooltip
            bodies (.tt), attributes, the cite line, the picture SVG, scripts. A first occurrence inside link text
            is reported as such: a tooltip cannot sit inside a link (plan 1564, ruling O3)
  ids       station ids are unique; every spur leaves from a station that exists; no page is listed twice
  game      no game-tree prefix appears anywhere in stations.json
  tracks    every non-game page is on exactly one track, and every tracked page exists

The game tree is pruned from the directory walk by prefix, so none of its files is ever listed or opened.
"""
import argparse, fnmatch, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ride_gloss  # noqa: E402

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def walk_pages(root, game_prefixes):
    out = []
    for d, dirs, files in os.walk(root):
        rel = os.path.relpath(d, root).replace(os.sep, "/")
        rel = "" if rel == "." else rel + "/"
        dirs[:] = sorted(x for x in dirs if not x.startswith(".")
                         and not any(fnmatch.fnmatch(rel + x + "/", g) for g in game_prefixes))
        out += [rel + f for f in files if f.endswith(".html")]
    return sorted(out)


def game_regex(prefixes):
    return re.compile("|".join(fnmatch.translate(p).replace(r"\Z", "").replace("(?s:", "(?:") for p in prefixes))


INLINE = {"span", "strong", "em", "a", "b", "i", "abbr", "code", "sup", "sub", "small", "mark", "q", "cite"}
VOID = {"br", "img", "meta", "link", "input", "hr", "source", "wbr"}
SKIP_TAGS = {"script", "style", "svg", "head", "template"}
PLAIN = {"html", "body", "main", "section", "div", "figure", "header", "footer", "nav", "ol"}


def jargon_problems(page, gl):
    """The O3 jargon check over the built ride page (see the module docstring, "jargon")."""
    from html.parser import HTMLParser
    words = ride_gloss.jargon(gl)
    terms = gl.get("terms") or {}
    pat = ride_gloss.pattern(words)
    lower = {w.lower(): w for w in words}
    blocks, order = {}, []
    probs = []

    class P(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=True)
            self.stack, self.n, self.after_spurs = [], 0, False

        def top(self, key, default=None):
            for f in reversed(self.stack):
                if f.get(key) is not None:
                    return f[key]
            return default

        def emit(self, text):
            if self.top("skip"):
                return
            b = self.top("block")
            if b is None:
                if not text.strip():
                    return
                self.n += 1
                b = f"loose text {self.n}"
            if b not in blocks:
                blocks[b] = []; order.append(b)
            blocks[b].append((text, self.top("link", False), self.top("anchor")))

        def handle_starttag(self, tag, attrs):
            at = dict(attrs)
            cls = (at.get("class") or "").split()
            f = {"tag": tag}
            if tag in SKIP_TAGS or "tt" in cls or (tag == "p" and "cite" in cls):
                f["skip"] = True
            if tag == "a":
                f["link"] = True
            if "tip" in cls and "gl" in cls:
                k = at.get("data-term")
                if k not in terms:
                    probs.append(f"a tooltip names {k!r}, which is not a glossary key")
                f["anchor"] = (id(f), {k})
            elif "tip" in cls and "terms" in cls:
                f["anchor"] = (id(f), set((at.get("data-terms") or "").split("|")))
            blk = None
            if tag == "li" and "station" in cls:
                blk = "station " + at.get("data-station", "?")
            elif tag == "section" and at.get("id") == "station-0-hall":
                blk = "station 0"                     # the ticket hall opens station 0's card at runtime
            elif (tag == "p" and ("lede" in cls or "howto" in cls)) or (tag == "figcaption" and self.top("figure")):
                blk = "About this map"
            elif (tag == "h2" and at.get("id") == "spurs") or (tag == "ul" and "spurs" in cls) or (tag == "p" and self.after_spurs):
                blk = "Side trips"
            elif self.top("block") is None and tag not in PLAIN and tag not in VOID:
                self.n += 1
                blk = f"<{tag}> {self.n}"
            if tag == "figure" and "ride-figure" in cls:
                f["figure"] = True
            if blk and self.top("block") is None:
                f["block"] = blk
            self.after_spurs = False
            if tag not in INLINE:
                self.emit("\n")
            if tag not in VOID:
                self.stack.append(f)

        def handle_endtag(self, tag):
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i]["tag"] == tag:
                    f = self.stack[i]
                    del self.stack[i:]
                    if tag == "h2" and f.get("block") == "Side trips":
                        self.after_spurs = True
                    break
            if tag not in INLINE:
                self.emit("\n")

        def handle_data(self, data):
            self.emit(data)

    P().feed(open(page, encoding="utf-8").read())
    for b in order:
        segs, text, starts = blocks[b], "", []
        for s in segs:
            starts.append(len(text)); text += s[0]
        import bisect

        def at(i):
            return segs[bisect.bisect_right(starts, i) - 1]
        seen = set()
        for m in pat.finditer(text):
            w = lower[m.group(0).lower()]
            if w in seen:
                continue
            seen.add(w)
            key, s0, s1 = words[w], at(m.start()), at(m.end() - 1)
            if s0[1]:
                probs.append(f"{b}: the first {m.group(0)!r} is inside link text (stop and report: no tooltip can sit in a link)")
            elif not (s0[2] and s1[2] and s0[2][0] == s1[2][0] and key in s0[2][1]):
                probs.append(f"{b}: the first {m.group(0)!r} is not a tooltip")
    return probs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(HERE, "docs"))
    ap.add_argument("--stations", default=None)
    ap.add_argument("--tracks", default=os.path.join(HERE, "scripts", "tracks.json"))
    ap.add_argument("--stations-schema", default=os.path.join(HERE, "docs", "ride", "stations.schema.json"))
    ap.add_argument("--tracks-schema", default=os.path.join(HERE, "scripts", "tracks.schema.json"))
    ap.add_argument("--glossary", default=None)
    ap.add_argument("--glossary-schema", default=os.path.join(HERE, "docs", "ride", "glossary.schema.json"))
    ap.add_argument("--gloss-fixture", default=os.path.join(HERE, "scripts", "fixtures", "ride", "carry-gloss-8943677.json"))
    a = ap.parse_args()
    stations_path = a.stations or os.path.join(a.root, "ride", "stations.json")
    glossary_path = a.glossary or os.path.join(a.root, "ride", "glossary.json")

    import jsonschema
    fails = []

    def check(name, problems):
        print(("PASS " if not problems else "FAIL ") + name + ("" if not problems else ": " + "; ".join(problems[:12])))
        if problems:
            fails.append(name)

    raw = open(stations_path, encoding="utf-8").read()
    st = json.loads(raw)
    tr = json.load(open(a.tracks, encoding="utf-8"))

    probs = []
    for doc, schema in ((st, a.stations_schema), (tr, a.tracks_schema)):
        v = jsonschema.Draft202012Validator(json.load(open(schema, encoding="utf-8")))
        probs += [f"{os.path.basename(schema)}: {'/'.join(map(str, e.absolute_path)) or '(root)'}: {e.message[:120]}"
                  for e in v.iter_errors(doc)]
    check("schema", probs)

    stations = st.get("stations", [])
    spurs = st.get("spurs", [])
    listed = []
    for s in stations:
        listed += [p for p in [s.get("expert")] + list(s.get("also") or []) + [s.get("start")] if p]
    listed += [s.get("expert") for s in spurs if s.get("expert")]
    check("paths", [p for p in listed if not os.path.isfile(os.path.join(a.root, p))])

    ride = os.path.join(a.root, "ride")
    probs = [f"station {s.get('id', '?')} has no image" for s in stations if not s.get("image")]
    probs += [f"station {s.get('id', '?')} has no image_alt" for s in stations if not (s.get("image_alt") or "").strip()]
    probs += [f"station {s.get('id', '?')}: missing {s['image']}" for s in stations
              if s.get("image") and not os.path.isfile(os.path.join(ride, s["image"]))]
    probs += [f"station {s.get('id', '?')}: expert_image without expert_image_alt" for s in stations
              if s.get("expert_image") and not (s.get("expert_image_alt") or "").strip()]
    probs += [f"station {s.get('id', '?')}: expert_image_alt without expert_image" for s in stations
              if s.get("expert_image_alt") and not s.get("expert_image")]
    probs += [f"station {s.get('id', '?')}: missing {s['expert_image']}" for s in stations
              if s.get("expert_image") and not os.path.isfile(os.path.join(ride, s["expert_image"]))]
    check("images", probs)

    gl = ride_gloss.load(glossary_path)
    terms = gl.get("terms") or {}
    probs = []
    for s in stations:
        c, sid = s.get("carry") or {}, s.get("id", "?")
        if c.get("name") != ", ".join(c.get("terms") or []):
            probs.append(f"station {sid}: carry.name {c.get('name')!r} is not carry.terms joined by ', '")
    fixture = json.load(open(a.gloss_fixture, encoding="utf-8"))
    for s in stations:
        c, sid = s.get("carry") or {}, s.get("id", "?")
        if sid not in fixture:
            probs.append(f"station {sid}: not in the round-trip fixture")
            continue
        missing = [k for k in c.get("terms") or [] if "l1" not in (terms.get(k) or {})]
        if missing:
            probs.append(f"station {sid}: cannot rebuild its gloss, no L1 for {missing}")
        elif ride_gloss.roundtrip(c, terms) != fixture[sid]:
            probs.append(f"station {sid}: L1s + note do not give back the old carry.gloss word for word")
    probs += [f"fixture station {i} is not a station" for i in fixture if i not in {s.get("id") for s in stations}]
    check("gloss", probs)

    v = jsonschema.Draft202012Validator(json.load(open(a.glossary_schema, encoding="utf-8")))
    probs = [f"glossary.schema.json: {'/'.join(map(str, e.absolute_path)) or '(root)'}: {e.message[:120]}"
             for e in v.iter_errors(gl)]
    for s in stations:
        for k in (s.get("carry") or {}).get("terms") or []:
            if k not in terms:
                probs.append(f"station {s.get('id', '?')}: dangling key {k!r}")
    for k, e in terms.items():
        e = e if isinstance(e, dict) else {}
        if not (e.get("l1") or "").strip():
            probs.append(f"{k!r} has no L1")
        elif ride_gloss.head(e["l1"], k) is None:
            probs.append(f"{k!r}: L1 does not open with the key and a colon")
        probs += [f"{k!r}: dangling see_also {x!r}" for x in e.get("see_also") or [] if x not in terms]
    probs += [f"jargon_extra {x.get('word')!r}: dangling see {x.get('see')!r}" for x in gl.get("jargon_extra") or []
              if x.get("see") not in terms]
    probs += [f"{k!r} has no L2 (one of the 18 flagged terms)" for k in ride_gloss.L2_REQUIRED
              if not ((terms.get(k) or {}).get("l2") or "").strip()]
    deep = sorted({k for s in stations if s.get("expert") for k in (s.get("carry") or {}).get("terms") or []})
    probs += [f"{k!r} has no L3 (its station has a Go deeper page)" for k in deep
              if k in terms and not ((terms.get(k) or {}).get("l3") or "").strip()]
    check("glossary", probs)

    check("jargon", jargon_problems(os.path.join(a.root, "ride", "index.html"), gl))

    check("live", [s.get("id", "?") for s in stations if s.get("state") == "live" and not s.get("expert")])

    ids = [s.get("id") for s in stations]
    probs = [f"duplicate id {i}" for i in sorted({i for i in ids if ids.count(i) > 1})]
    probs += [f"spur {s.get('expert')} leaves from unknown station {s.get('from')}" for s in spurs if s.get("from") not in ids]
    probs += [f"listed twice: {p}" for p in sorted({p for p in listed if listed.count(p) > 1})]
    check("ids", probs)

    game = tr.get("game_prefixes", [])
    rx = game_regex(game)
    hits = sorted({m.group(0) for m in rx.finditer(raw)})
    check("game", [f"game prefix in stations.json: {h}" for h in hits])

    on_disk = walk_pages(a.root, game)
    tracked = [p for t in tr.get("tracks", {}).values() for p in t]
    probs = [f"untracked: {p}" for p in on_disk if p not in tracked]
    probs += [f"on two tracks: {p}" for p in sorted({p for p in tracked if tracked.count(p) > 1})]
    probs += [f"tracked but missing: {p}" for p in tracked if p not in on_disk]
    probs += [f"game page tracked: {p}" for p in tracked if rx.match(p)]
    check("tracks", probs)

    print(f"{len(stations)} stations, {len(spurs)} spurs, {len(on_disk)} non-game pages; "
          + ("ALL PASS" if not fails else "FAILED: " + ", ".join(fails)))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
