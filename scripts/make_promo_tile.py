"""
Generates the Chrome Web Store small promo tile: 440x280, 24-bit PNG no alpha.
Run:  python3 scripts/make_promo_tile.py
Output: screenshots/store/promo_440x280.png
"""

import os, sys, math

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Run:  pip3 install Pillow")

W, H = 440, 280
OUT = os.path.join(os.path.dirname(__file__), "..", "screenshots", "store", "promo_440x280.png")
os.makedirs(os.path.dirname(OUT), exist_ok=True)

# ── Colours ──────────────────────────────────────────────
BG       = (254, 252, 248)   # #fefcf8  warm parchment
BG2      = (245, 240, 232)   # #f5f0e8  slightly deeper for card
BORDER   = (224, 216, 200)   # #e0d8c8
ROSE     = (224,  80, 122)   # #e0507a  feminine / la
AMBER    = (212, 146,  10)   # #d4920a  masculine / le
TEXT_D   = ( 26,  24,  20)   # #1a1814  dark text
TEXT_M   = (106,  88,  64)   # #6a5840  mid text
SEP      = (207, 195, 170)   # separator

img  = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# ── Subtle dot-grid texture ───────────────────────────────
for y in range(0, H, 20):
    for x in range(0, W, 20):
        draw.ellipse([x-1, y-1, x+1, y+1], fill=(200, 192, 178))

# ── Centre card ──────────────────────────────────────────
cx, cy = W // 2, H // 2
cw, ch = 340, 200
rx, ry = cx - cw//2, cy - ch//2

# Card shadow
for i in range(8, 0, -1):
    alpha = int(18 - i*1.5)
    sc = (min(255, BG[0]-alpha), min(255, BG[1]-alpha), min(255, BG[2]-alpha))
    draw.rounded_rectangle([rx+i, ry+i, rx+cw+i, ry+ch+i], radius=20, fill=sc)

# Card fill + border
draw.rounded_rectangle([rx, ry, rx+cw, ry+ch], radius=20, fill=BG2, outline=BORDER, width=1)

# ── Brand pill (la | le) ─────────────────────────────────
pill_w, pill_h = 96, 36
px, py = cx - pill_w//2, ry + 28
draw.rounded_rectangle([px, py, px+pill_w, py+pill_h], radius=10, fill=BG, outline=SEP, width=1)

# Try to load system fonts, fall back to default
def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()

font_pill  = load_font(14, bold=True)
font_brand = load_font(26, bold=True)
font_tag   = load_font(14)
font_small = load_font(12)
font_big   = load_font(72, bold=True)

# "la" in rose
draw.text((px + 10, py + 10), "la", fill=ROSE,  font=font_pill)
# separator line
draw.line([(px + 46, py + 8), (px + 46, py + 28)], fill=SEP, width=1)
# "le" in amber
draw.text((px + 54, py + 10), "le", fill=AMBER, font=font_pill)

# ── Big "la · le" typographic display ────────────────────
big_y = ry + 72

# "la"
la_bbox = draw.textbbox((0, 0), "la", font=font_big)
la_w = la_bbox[2] - la_bbox[0]
dot_space = 28
le_bbox = draw.textbbox((0, 0), "le", font=font_big)
le_w = le_bbox[2] - le_bbox[0]
total = la_w + dot_space + le_w
start_x = cx - total // 2

draw.text((start_x,             big_y), "la", fill=ROSE,  font=font_big)
draw.text((start_x + la_w + 6,  big_y + 18), "·", fill=SEP,   font=load_font(40))
draw.text((start_x + la_w + dot_space, big_y), "le", fill=AMBER, font=font_big)

# ── Tagline ───────────────────────────────────────────────
tag = "French word gender, instantly."
tb  = draw.textbbox((0, 0), tag, font=font_tag)
tw  = tb[2] - tb[0]
draw.text((cx - tw//2, ry + ch - 52), tag, fill=TEXT_M, font=font_tag)

# ── Small source line ─────────────────────────────────────
sub = "2000+ words  ·  hover any page  ·  zero tracking"
sb  = draw.textbbox((0, 0), sub, font=font_small)
sw  = sb[2] - sb[0]
draw.text((cx - sw//2, ry + ch - 30), sub, fill=(160, 144, 112), font=font_small)

# ── Save ─────────────────────────────────────────────────
img.save(OUT, "PNG")
print(f"Saved → {OUT}")
