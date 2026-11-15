#!/usr/bin/env python3
"""Light↔dark pixel diff for every captured baseline pair.

Run from the evidence directory:  python3 diff-theme-pairs.py
Numbers in VISUAL_BASELINES_INDEX.md §7.2 come from this script, not by hand.
"""

import glob
import os
import re
import sys

from PIL import Image
import numpy as np

STATE_ORDER = ('landing-intro', 'login-form', 'onboarding-step', 'proxy-interstitial')
NAME = re.compile(r'^(.+)-(light|dark)-(.+)\.png$')


def pairs(pattern='baselines/*.png'):
    by_key = {}
    for path in sorted(glob.glob(pattern)):
        match = NAME.match(os.path.basename(path))
        if not match:
            continue
        viewport, theme, state = match.groups()
        by_key.setdefault((viewport, state), {})[theme] = path
    return by_key


def main():
    by_key = pairs(sys.argv[1] if len(sys.argv) > 1 else 'baselines/*.png')
    print('%-14s %-20s %10s %10s %8s' % ('viewport', 'state', 'identical', 'diff %', 'max delta'))
    for (viewport, state), themes in sorted(by_key.items(), key=lambda kv: (STATE_ORDER.index(kv[0][1]) if kv[0][1] in STATE_ORDER else 99, kv[0][0])):
        if 'light' not in themes or 'dark' not in themes:
            continue
        a = np.asarray(Image.open(themes['light']).convert('RGB'), dtype=np.int16)
        b = np.asarray(Image.open(themes['dark']).convert('RGB'), dtype=np.int16)
        if a.shape != b.shape:
            print('%-14s %-20s SHAPE MISMATCH %s %s' % (viewport, state, a.shape, b.shape))
            continue
        delta = np.abs(a - b)
        print('%-14s %-20s %10s %9.4f%% %8d' % (
            viewport, state, str(bool(delta.max() == 0)), (delta.max(axis=2) > 0).mean() * 100, delta.max()))


if __name__ == '__main__':
    main()
