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
