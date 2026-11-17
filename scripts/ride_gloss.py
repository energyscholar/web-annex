"""ride_gloss.py: the ride's glossary (docs/ride/glossary.json; plan 1564, after plan 1554 phase 3d).

Each glossary key is a jargon term spelled as the ride spells it. A key carries up to three levels:
  l1  plain words, always shown. It opens with its heading and a colon ("BKT (Berezinskii-Kosterlitz-Thouless): ...");
      the heading is the key, or the key followed by more words.
  l2  an everyday picture-word, one sentence (optional per key; required for L2_REQUIRED).
  l3  the physicist's statement, shown only after a deliberate click (optional per key; required for every term
      of a station that has a "Go deeper" page).
A station's carry.terms names its keys. The station's own words that used to follow a term's gloss and describe the
station live in carry.note. Joining a station's L1s and its note with "; " gives back the station's old carry.gloss
word for word (the round-trip, frozen in scripts/fixtures/ride/carry-gloss-8943677.json).

Used by scripts/ride-build.py (the tooltips) and scripts/check-stations.py (the "gloss" and "glossary" checks).
"""
import json

# plan 1564 section 1.3 and ruling O5: the 18 terms a reader flagged, which must carry a picture-word (l2)
L2_REQUIRED = ["critical point", "order parameter", "universality", "fixed point", "BKT", "stiffness jump",
               "gradient sign", "Ashkin-Teller", "four-spin coupling", "surveyor's tools", "finite-size scaling",
               "first-order", "coexistence", "fractional quantum Hall", "filling factor", "Criticality Compass",
               "compass rose", "Poised Realm"]


def load(path):
    return json.load(open(path, encoding="utf-8"))


def head(l1, key):
    """The L1's heading if it opens with key and a colon, else None."""
    i = l1.find(": ")
    if i < 0:
        return None
    h = l1[:i]
    return h if h == key or h.startswith(key + " ") else None


def split_l1(l1):
    """(heading, rest) at the first ": ", for a bold heading; (None, l1) if there is none."""
    i = l1.find(": ")
    return (l1[:i], l1[i + 2:]) if i >= 0 else (None, l1)


def roundtrip(carry, terms):
    """The station's old carry.gloss, rebuilt from its glossary L1s and its note."""
    parts = [terms[k]["l1"] for k in carry.get("terms", [])]
    if carry.get("note"):
        parts.append(carry["note"])
    return "; ".join(parts)
