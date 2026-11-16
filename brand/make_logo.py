"""Logo AFHMA Franconville en SVG vectoriel (texte converti en contours)."""
import sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONTS, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
bsd = instantiateVariableFont(TTFont(FONTS / "bsd.ttf"), {"wght": 900})
arc = instantiateVariableFont(TTFont(FONTS / "archivo-it.ttf"), {"wght": 700, "wdth": 100})

def run(font, text, size, tracking=0.0):
    """Liste de (char, d, x0, x1) placés à partir de x=0, ligne de base y=0."""
    gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    upm = font["head"].unitsPerEm
    k = size / upm
    x, out = 0.0, []
    for ch in text:
        gname = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[gname].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
        adv = hmtx[gname][0] * k
        out.append((ch, pen.getCommands(), x, x + adv))
        x += adv + tracking * size
    return out, x - tracking * size

def placed(font, text, size, cx, base, tracking=0.0, cls=lambda ch, i: "ink"):
    glyphs, w = run(font, text, size, tracking)
    dx = cx - w / 2
    return "".join(f'<path class="{cls(ch, i)}" transform="translate({dx:.2f} {base})" d="{d}"/>'
                   for i, (ch, d, _, _) in enumerate(glyphs))

# ---- emblème fidèle à l'original : arc rouge du mouvement, barre fine derrière l'athlète,
#      disques détourés en perspective, athlète en fente (tête, « j » + jambe en « n »)
def plates(cx, cy, rot, rxs, rys, step, sleeve_dir):
    out = [f'<g transform="rotate({rot} {cx} {cy})">']
    sx = cx + sleeve_dir * (step * len(rxs) + 4)
    out.append(f'<rect class="plate" x="{min(cx, sx + sleeve_dir * 22) - 2}" y="{cy - 7}" width="{abs(sx + sleeve_dir * 22 - cx) + 4}" height="14" rx="7" stroke-width="5"/>')
    for i, (rx, ry) in enumerate(zip(rxs, rys)):
        out.append(f'<ellipse class="plate" cx="{cx + sleeve_dir * step * i}" cy="{cy}" rx="{rx}" ry="{ry}" stroke-width="5.5"/>')
    out.append(f'<ellipse class="ink" cx="{cx + sleeve_dir * step * (len(rxs) - 1)}" cy="{cy}" rx="4" ry="9"/>')
    out.append("</g>")
    return "".join(out)

EMBLEM = (
    '<g class="emblem">'
    '<path class="red-s" d="M84,74 C130,8 268,6 322,92" fill="none" stroke-width="9" stroke-linecap="round"/>'
    '<path class="bar" d="M70,112 C160,124 250,142 336,158" fill="none" stroke-width="7" stroke-linecap="round"/>'
    + plates(84, 104, -28, [16, 18, 20], [40, 46, 52], -12, -1)
    + plates(314, 156, -14, [20, 22, 24], [50, 56, 62], 11, 1) +
    '<circle class="ink" cx="196" cy="96" r="14"/>'
    '<path class="ink-s" d="M194,126 C193,160 194,196 190,214 C186,236 168,246 148,240" fill="none" stroke-width="15" stroke-linecap="round"/>'
    '<path class="ink-s" d="M196,170 C206,152 226,148 236,160 C242,170 242,196 244,232" fill="none" stroke-width="14" stroke-linecap="round"/>'
    "</g>"
)

def lockup(pieces, cx, base, gap=6):
    """pièces (police, texte, taille, classe) posées côte à côte, centrées sur cx."""
    runs = [(run(f, t, z, tr), c, sx) for f, t, z, c, sx, tr in pieces]
    total = sum(w * sx for (_, w), _, sx in runs) + gap * (len(runs) - 1)
    x, out = cx - total / 2, []
    for (glyphs, w), c, sx in runs:
        out += [f'<path class="{c}" transform="translate({x:.2f} {base}) scale({sx} 1)" d="{d}"/>' for _, d, _, _ in glyphs]
        x += w * sx + gap
    return "".join(out)

def word(cx=200, base=352):
    return lockup([(bsd, "A", 138, "red", 1.5, 0), (bsd, "FHM", 74, "ink", 1.3, 0.03), (bsd, "A", 138, "red", 1.5, 0)], cx, base, 6)

def town(cx=200, base=392, size=36):
    return placed(arc, "FRANCONVILLE", size, cx, base, 0.05, lambda ch, i: "town")

def style(ink, steel, hole, red="#d71a2c", town="#3a3a3e"):
    return (f"<style>.ink{{fill:{ink}}}.ink-s,.bar{{stroke:{ink}}}.steel{{fill:{steel}}}"
            f".hole{{fill:{hole}}}.red{{fill:{red}}}.red-s{{stroke:{red}}}.plate{{fill:{hole};stroke:{ink}}}.town{{fill:{town}}}</style>")

def svg(view, body, st, title="AFHMA Franconville"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" role="img" aria-label="{title}">'
            f"<title>{title}</title>{st}{body}</svg>\n")

full = EMBLEM + word() + town()
VIEW = "0 0 400 404"
(OUT / "logo-afhma.svg").write_text(svg(VIEW, full, style("#141414", "#9ca1a8", "#ffffff")))
(OUT / "logo-afhma-dark.svg").write_text(svg(VIEW, full, style("#f4f1ec", "#7d838c", "#0b0b0d", town="#c9c6cf")))
# version site : couleurs pilotées par le CSS de la page (currentColor = encre du thème)
site = svg(VIEW, full, "<style>.ink{fill:currentColor}.ink-s,.bar{stroke:currentColor}"
           ".steel{fill:var(--logo-steel,#9ca1a8)}.hole{fill:var(--logo-hole,#fff)}.red{fill:var(--logo-red,#d71a2c)}"
           ".red-s{stroke:var(--logo-red,#d71a2c)}.plate{fill:var(--logo-hole,#fff);stroke:currentColor}.town{fill:var(--logo-town,currentColor)}</style>")
(OUT / "logo-site.svg").write_text(site)
# favicon : emblème + « A » rouge sur fond blanc arrondi
fav_body = (f'<rect x="20" y="20" width="360" height="360" rx="80" fill="#ffffff"/>'
            f'<g transform="translate(-4 52) scale(1.02)">{EMBLEM}</g>')
(OUT / "favicon.svg").write_text(svg("20 20 360 360", fav_body, style("#141414", "#9ca1a8", "#ffffff")))
print("ok", [p.name for p in OUT.iterdir()])

# ---- version horizontale (en-tête du site) : même emblème + même « AFHMA » + FRANCONVILLE
#      encre = currentColor (suit le thème), rouge du club conservé
def lockup_h():
    (ga, wa), (gf, wf) = run(bsd, "A", 138), run(bsd, "FHM", 74, 0.03)
    widths = [wa * 1.5, wf * 1.3, wa * 1.5]
    total = sum(widths) + 12
    x0 = 392
    word_svg = lockup([(bsd, "A", 138, "red", 1.5, 0), (bsd, "FHM", 74, "ink", 1.3, 0.03), (bsd, "A", 138, "red", 1.5, 0)], x0 + total / 2, 196, 6)
    town_svg = placed(arc, "FRANCONVILLE", 33, x0 + total / 2, 244, 0.05, lambda ch, i: "town")
    return f"0 0 {x0 + total + 8:.0f} 262", EMBLEM + word_svg + town_svg

view_h, body_h = lockup_h()
CSS_SITE = ("<style>.ink{fill:currentColor}.ink-s,.bar{stroke:currentColor}.red{fill:#d71a2c}.red-s{stroke:#d71a2c}"
            ".plate{fill:var(--surface,#fff);stroke:currentColor}.town{fill:currentColor;opacity:.62}</style>")
(OUT / "lockup.svg").write_text(svg(view_h, body_h, CSS_SITE))
(OUT / "lockup-light.svg").write_text(svg(view_h, body_h, style("#141414", "#9ca1a8", "#ffffff")))
