#!/usr/bin/env python3
"""Edge-seam fix for the region pictures (Graphic Design, 9 Nov 2026). Run it after ANY rebuild of images/tex-region.jpg or images/m1/tex-region.jpg
(tools/build-map.py REGION has wrap=False, so a rebuild brings the dark last column and last rows back until build-map.py pads non-wrapping pictures).

    python3 tools/fix-region-seam.py images/tex-region.jpg images/m1/tex-region.jpg

It mirrors the last 4 columns and 4 rows from just inside (col 1996<-1995, 1997<-1994, 1998<-1993, 1999<-1992; same for rows) and re-saves at
JPEG quality 95, subsampling 0. The pictures committed in 3.4.0 already have it applied; running it twice is harmless.
"""
import sys
from PIL import Image
import numpy as np
N = 4
for path in sys.argv[1:]:
    a = np.asarray(Image.open(path).convert('RGB')).copy()
    H, W = a.shape[:2]
    for k in range(N):
        a[:, W - N + k] = a[:, W - N - 1 - k]
        a[H - N + k] = a[H - N - 1 - k]
    Image.fromarray(a).save(path, 'JPEG', quality=95, subsampling=0)
    print(path, 'fixed')
