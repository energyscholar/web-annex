"""2D Ising lattice at critical temperature (Swendsen-Wang), rendered as coloured domains.
Run from the repo root: python3 -I scripts/ising_critical.py [--square]
"""
import os, sys, time
import numpy as np
from scipy import ndimage
from PIL import Image
from matplotlib import colormaps

TC = 2.0 / np.log(1.0 + np.sqrt(2.0))
SWEEPS = 3000


def find(p, x):
    while p[x] != x:
        p[x] = p[p[x]]
        x = p[x]
    return x


def label_periodic(mask):
    """4-connected labelling of a boolean mask on a torus. Returns (labels, n)."""
    H, W = mask.shape
    lab, n = ndimage.label(mask)
    parent = np.arange(n + 1)
    pairs = []
    for a, b in ((lab[:, 0], lab[:, -1]), (lab[0, :], lab[-1, :])):
        ok = (a > 0) & (b > 0) & (a != b)
        pairs.append(np.stack([a[ok], b[ok]], 1))
    pairs = np.unique(np.concatenate(pairs), axis=0) if pairs else np.zeros((0, 2), int)
    for a, b in pairs:
        ra, rb = find(parent, int(a)), find(parent, int(b))
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)
    roots = np.array([find(parent, i) for i in range(n + 1)])
    uniq, inv = np.unique(roots, return_inverse=True)
    # index 0 (background) maps to root 0 -> inv value 0
    return inv[lab], len(uniq) - 1


def sw_sweep(s, rng, p):
    H, W = s.shape
    right = (s == np.roll(s, -1, 1)) & (rng.random((H, W)) < p)
    down = (s == np.roll(s, -1, 0)) & (rng.random((H, W)) < p)
    # label clusters via sparse connected components on the torus
    from scipy.sparse import coo_matrix
    from scipy.sparse.csgraph import connected_components
    idx = np.arange(H * W).reshape(H, W)
    r = np.concatenate([idx[right], idx[down]])
    c = np.concatenate([np.roll(idx, -1, 1)[right], np.roll(idx, -1, 0)[down]])
    g = coo_matrix((np.ones(len(r), np.int8), (r, c)), shape=(H * W, H * W))
    n, lab = connected_components(g, directed=False)
    flip = rng.random(n) < 0.5
    return np.where(flip[lab].reshape(H, W), -s, s)


def simulate(H, W, seed=1464):
    rng = np.random.default_rng(seed)
    s = rng.choice(np.array([-1, 1], np.int8), size=(H, W))
    p = 1.0 - np.exp(-2.0 / TC)
    for _ in range(SWEEPS):
        s = sw_sweep(s, rng, p)
    return s


def colour(s):
    H, W = s.shape
    rgb = np.zeros((H, W, 3), np.uint8)
    for sign, cmap in ((1, colormaps["plasma"]), (-1, colormaps["viridis"])):
        lab, n = label_periodic(s == sign)
        if n == 0:
            continue
        area = np.bincount(lab.ravel(), minlength=n + 1).astype(float)
        mx = max(area[1:].max(), 2.0)
        pos = 0.15 + 0.8 * np.log10(np.maximum(area, 1.0)) / np.log10(mx)
        cols = (cmap(pos)[:, :3] * 255).round().astype(np.uint8)
        m = s == sign
        rgb[m] = cols[lab[m]]
    return rgb


def up(rgb, k):
    return np.repeat(np.repeat(rgb, k, 0), k, 1)


def save(arr, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(arr).save(path, optimize=False)


def main():
    square = "--square" in sys.argv
    H, W = (540, 540) if square else (315, 600)
    t0 = time.time()
    s = simulate(H, W)
    print("elapsed %.1f s, |m| = %.4f" % (time.time() - t0, abs(s.mean())))
    big = up(colour(s), 2)
    if square:
        save(big, "docs/art/square/ising-critical-1080.png")
    else:
        save(big, "docs/art/og/multicriticality.png")
        crop = big[(630 - 320) // 2:(630 - 320) // 2 + 320, 40:40 + 1120]
        thumb = np.asarray(Image.fromarray(crop).resize((560, 160), Image.NEAREST))
        save(thumb, "docs/art/thumbnails/multicriticality.png")


main()
