#!/usr/bin/env python3
"""
check-stations.py — validate the line's two manifests against their schemas and against disk.

  python3 scripts/check-stations.py                       # docs/ride/stations.json + scripts/tracks.json
  python3 scripts/check-stations.py --stations FILE --tracks FILE --root DIR

Checks, each printed as one line, exit 1 on any failure:
  schema    stations.json and tracks.json validate against their schemas (jsonschema)
  paths     every non-null expert / also / spur path exists under the docs root
  live      every live station names an expert page
  ids       station ids are unique; every spur leaves from a station that exists; no page is listed twice
  game      no game-tree prefix appears anywhere in stations.json
  tracks    every non-game page is on exactly one track, and every tracked page exists

The game tree is pruned from the directory walk by prefix, so none of its files is ever listed or opened.
"""
import argparse, fnmatch, json, os, re, sys

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
    a = ap.parse_args()
    stations_path = a.stations or os.path.join(a.root, "ride", "stations.json")

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
