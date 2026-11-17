"""ride_gloss.py: one gloss per jargon term on a station's carry (plan 1554, phase 3d).

carry.name is a comma list of terms ("BKT, stiffness jump"); carry.gloss is one sentence per term, the
segments joined by "; ", each term's own segment opening with that term and a colon
("BKT (Berezinskii-Kosterlitz-Thouless): ..."). A segment that does not open with the next term in the list
carries on the previous term's gloss ("...; the word is used in three different senses, ..."). The wording is
never changed: joining every term's gloss with "; " gives the original text back.

Used by scripts/ride-build.py (one tooltip per term) and scripts/check-stations.py (the "gloss" check).
"""


def _head(seg, term):
    """The segment's heading if it opens with term and a colon, else None."""
    i = seg.find(": ")
    if i < 0:
        return None
    head = seg[:i]
    return head if head == term or head.startswith(term + " ") else None


def split(name, gloss):
    """[(term, head, text)] for each term in name, or raise ValueError saying what does not match."""
    terms = [t for t in name.split(", ")]
    segs = gloss.split("; ")
    out = []
    for seg in segs:
        nxt = terms[len(out)] if len(out) < len(terms) else None
        head = _head(seg, nxt) if nxt else None
        if head is not None:
            out.append([nxt, head, seg[len(head) + 2:]])
        elif out:
            out[-1][2] += "; " + seg
        else:
            raise ValueError(f"gloss does not open with its first term {terms[0]!r}: {seg[:40]!r}")
    if len(out) != len(terms):
        missing = [t for t in terms[len(out):]]
        raise ValueError(f"{len(terms)} terms but {len(out)} glosses; no gloss opens with {missing}")
    rebuilt = "; ".join(h + ": " + x for _, h, x in out)
    if rebuilt != gloss:
        raise ValueError("split does not give the gloss back word for word")
    return [tuple(o) for o in out]
