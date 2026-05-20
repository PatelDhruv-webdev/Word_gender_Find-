"""
Resize screenshots for Chrome Web Store (1280x800, 24-bit PNG, no alpha).
Place your raw screenshots in a folder called  screenshots/raw/
Run:  python3 scripts/resize_screenshots.py
Output goes to  screenshots/store/
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow not found. Run:  pip3 install Pillow")

# Chrome Web Store required size
TARGET_W, TARGET_H = 1280, 800

# Warm parchment background — matches the app's light theme
BG_COLOR = (254, 252, 248)  # #fefcf8

RAW_DIR   = os.path.join(os.path.dirname(__file__), "..", "screenshots", "raw")
OUT_DIR   = os.path.join(os.path.dirname(__file__), "..", "screenshots", "store")
os.makedirs(OUT_DIR, exist_ok=True)

supported = (".png", ".jpg", ".jpeg", ".webp")
files = sorted(
    f for f in os.listdir(RAW_DIR)
    if os.path.splitext(f)[1].lower() in supported
)

if not files:
    sys.exit(f"No images found in {RAW_DIR}\nAdd your screenshots there and re-run.")

for fname in files:
    src = os.path.join(RAW_DIR, fname)
    img = Image.open(src).convert("RGB")  # strip alpha, convert to 24-bit

    # Scale down proportionally if the screenshot is larger than the canvas
    img.thumbnail((TARGET_W, TARGET_H), Image.LANCZOS)

    # Create canvas and paste centred
    canvas = Image.new("RGB", (TARGET_W, TARGET_H), BG_COLOR)
    x = (TARGET_W - img.width)  // 2
    y = (TARGET_H - img.height) // 2
    canvas.paste(img, (x, y))

    stem = os.path.splitext(fname)[0]
    out_path = os.path.join(OUT_DIR, f"{stem}_1280x800.png")
    canvas.save(out_path, "PNG")
    print(f"  ✓ {fname}  →  {os.path.basename(out_path)}  ({img.width}×{img.height} centred)")

print(f"\nDone — {len(files)} file(s) saved to screenshots/store/")
