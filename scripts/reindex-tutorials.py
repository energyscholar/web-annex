#!/usr/bin/env python3
"""
reindex-tutorials.py — regenerate the tutorial manifest FROM DISK TRUTH, with checksums.

Same philosophy as the science library's reindex.py: disk is the truth, the manifest is derived,
and re-running is always safe. The point of the checksums is DRIFT DETECTION — the manifest records
the sha256 of every tutorial at index time, so a later run can say exactly which files changed,
which are new, and which are gone since the manifest was last written.

Writes:
  TUTORIAL-MANIFEST.json      machine master (one record per tutorial, with sha256)
  TUTORIAL-CHECKSUMS.sha256   sha256sum -c compatible
  TUTORIAL-MANIFEST.md        regenerates ONLY the block between the GENERATED markers;
                              every hand-curated section above/below it is preserved verbatim.

Usage:
  python3 scripts/reindex-tutorials.py                 # index docs/, report drift
  python3 scripts/reindex-tutorials.py --check         # report drift, write nothing (exit 1 if drift)
  python3 scripts/reindex-tutorials.py --root DIR --out PREFIX

PUBLIC-SAFE: emits only repo-relative paths and content-derived facts. No absolute paths, no
usernames, no private repo names.
"""
import argparse, hashlib, json, os, re, sys, glob
from datetime import datetime, timezone

BEGIN = "<!-- BEGIN GENERATED INVENTORY — edited by scripts/reindex-tutorials.py, do not hand-edit -->"
END   = "<!-- END GENERATED INVENTORY -->"
GUARD_MARK = "PHYSICS EDITORIAL STANDARD"

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(65536), b""):
            h.update(b)
    return h.hexdigest()

def strip_inert(s):
    return re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S | re.I)

def probe(path, root):
    raw = open(path, encoding="utf-8", errors="replace").read()
    body = strip_inert(raw)
    t = re.search(r"<title[^>]*>(.*?)</title>", raw, re.S | re.I)
    d = re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', raw, re.S | re.I)
    rel = os.path.relpath(path, root).replace(os.sep, "/")
    return {
        "path": rel,
        "series": rel.split("/")[0] if "/" in rel else ".",
        "title": re.sub(r"\s+", " ", t.group(1)).strip() if t else None,
        "sha256": sha256(path),
        "bytes": os.path.getsize(path),
        "lines": raw.count("\n") + 1,
        "modified": datetime.fromtimestamp(os.path.getmtime(path), timezone.utc).strftime("%Y-%m-%d"),
        "has_meta_description": bool(d),
        "tooltips": len(re.findall(r'class="[^"]*\btip\b[^"]*"', body)),
        "footnotes": len(re.findall(r'id="fn\d+"', body)),
        "physics_guard": GUARD_MARK in raw,
        "anchors_cited": len(set(re.findall(r"Anchor\s+(\d+)", body))),
        "dois": len(set(re.findall(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", body))),
    }

def load_prev(jpath):
    try:
        return {r["path"]: r for r in json.load(open(jpath))}
    except Exception:
        return {}

def drift(prev, cur):
    pk, ck = set(prev), {r["path"] for r in cur}
    changed = sorted(p for p in pk & ck if prev[p].get("sha256") != next(r for r in cur if r["path"] == p)["sha256"])
    return {"new": sorted(ck - pk), "removed": sorted(pk - ck), "changed": changed,
            "unchanged": sorted((pk & ck) - set(changed))}

def md_block(recs, dr, stamp):
    L = [BEGIN, "",
         f"*Generated {stamp} by `scripts/reindex-tutorials.py` from disk. "
         f"{len(recs)} tutorials. Re-run to refresh; the sha256 column is how we tell what has "
         f"drifted since the last index.*", ""]
    g = sum(r["physics_guard"] for r in recs)
    L += [f"**Coverage:** {g}/{len(recs)} carry the physics editorial standard · "
          f"{sum(bool(r['has_meta_description']) for r in recs)}/{len(recs)} have a meta description · "
          f"{sum(r['tooltips'] > 0 for r in recs)}/{len(recs)} have tooltips · "
          f"{sum(r['dois'] > 0 for r in recs)}/{len(recs)} cite at least one DOI.", ""]
    if dr:
        parts = [f"**{k}:** {len(v)}" for k, v in dr.items()]
        L += ["**Since last index** — " + " · ".join(parts), ""]
        for k in ("new", "changed", "removed"):
            if dr.get(k):
                L.append(f"- *{k}*: " + ", ".join(f"`{p}`" for p in dr[k][:24]) +
                         (" …" if len(dr[k]) > 24 else ""))
        L.append("")
    for series in sorted({r["series"] for r in recs}):
        rows = [r for r in recs if r["series"] == series]
        L += [f"### `{series}/` — {len(rows)} file(s)", "",
              "| File | Title | Lines | Guard | Tips | Fn | DOIs | Modified | sha256 |",
              "|---|---|---:|:--:|---:|---:|---:|---|---|"]
        for r in sorted(rows, key=lambda x: x["path"]):
            L.append("| `{}` | {} | {} | {} | {} | {} | {} | {} | `{}` |".format(
                r["path"], (r["title"] or "—")[:52], r["lines"],
                "✅" if r["physics_guard"] else "—",
                r["tooltips"], r["footnotes"], r["dois"], r["modified"], r["sha256"][:12]))
        L.append("")
    L.append(END)
    return "\n".join(L)

def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=os.path.join(here, "docs"))
    ap.add_argument("--out", default=os.path.join(here, "TUTORIAL"))
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    files = sorted(glob.glob(os.path.join(a.root, "**", "*.html"), recursive=True))
    recs = [probe(f, a.root) for f in files]
    jpath = a.out + "-MANIFEST.json"
    dr = drift(load_prev(jpath), recs)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%MZ")

    print(f"tutorials: {len(recs)} | guard: {sum(r['physics_guard'] for r in recs)}/{len(recs)}")
    print(f"drift vs last index — new {len(dr['new'])}, changed {len(dr['changed'])}, "
          f"removed {len(dr['removed'])}, unchanged {len(dr['unchanged'])}")
    for k in ("new", "changed", "removed"):
        for p in dr[k]:
            print(f"  {k.upper():9} {p}")
    if a.check:
        sys.exit(1 if (dr["new"] or dr["changed"] or dr["removed"]) else 0)

    json.dump(recs, open(jpath, "w"), indent=1)
    with open(a.out + "-CHECKSUMS.sha256", "w") as f:
        for r in recs:
            f.write(f"{r['sha256']}  {r['path']}\n")

    mpath = a.out + "-MANIFEST.md"
    block = md_block(recs, dr, stamp)
    if os.path.exists(mpath):
        s = open(mpath, encoding="utf-8").read()
        if BEGIN in s and END in s:
            s = s[:s.index(BEGIN)] + block + s[s.index(END) + len(END):]
        else:
            s = s.rstrip() + "\n\n---\n\n## Generated Inventory (checksummed)\n\n" + block + "\n"
        open(mpath, "w", encoding="utf-8").write(s)
    else:
        open(mpath, "w", encoding="utf-8").write("# Tutorial Manifest\n\n" + block + "\n")
    print(f"wrote {os.path.basename(jpath)}, {os.path.basename(a.out)}-CHECKSUMS.sha256, "
          f"{os.path.basename(mpath)}")

if __name__ == "__main__":
    main()
