#!/usr/bin/env python3
"""Generate MONOCHROME genre icon silhouettes (currentColor, transparent holes)
for the web (public/genres) and iOS asset catalog (template rendering).

Edit GLYPHS below to tweak an icon, then regenerate both clients:

    uv run python client/tools/gen-genre-icons.py            # write assets
    uv run python client/tools/gen-genre-icons.py --preview  # + open-able preview

Keep the bucket keys in sync with client/web/src/genreIcons.js and
client/ios/Canary/Views/GenreIcon.swift (the genre -> bucket maps)."""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CLIENT = os.path.dirname(HERE)
WEB = os.path.join(CLIENT, "web", "public", "genres")
IOS = os.path.join(CLIENT, "ios", "Canary", "Assets.xcassets")

# key -> glyph markup. fill inherits currentColor; strokes set stroke explicitly.
# Holes use fill-rule="evenodd" so they stay transparent on any background.
GLYPHS = {
    "rock": '<path d="M36 13 L20 36 H30 L26 53 L46 27 H34 Z"/>',
    "punk": ('<rect x="16" y="39" width="36" height="6" rx="2"/>'
             '<path d="M17 40 L24 18 L30 40 Z M27 40 L34 15 L41 40 Z M38 40 L46 19 L52 40 Z"/>'),
    "metal": ('<path fill-rule="evenodd" d="M32 14 C21 14 14 21 14 31 C14 37 17 41 21 43 L21 47 '
              'C21 49 22 50 24 50 L26 50 L26 46 L28 46 L28 50 L31 50 L31 46 L33 46 L33 50 L36 50 '
              'L36 46 L38 46 L38 50 L40 50 C42 50 43 49 43 47 L43 43 C47 41 50 37 50 31 '
              'C50 21 43 14 32 14 Z '
              'M20.5 31 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0 Z '
              'M34.5 31 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0 Z '
              'M32 36 l-3 6 h6 Z"/>'),
    "pop": '<path d="M32 15 l5.3 10.7 11.8 1.7 -8.5 8.3 2 11.8 -10.6 -5.6 -10.6 5.6 2 -11.8 -8.5 -8.3 11.8 -1.7 z"/>',
    "hiphop": ('<rect x="26" y="13" width="12" height="21" rx="6"/>'
               '<path d="M22 30 a10 10 0 0 0 20 0" fill="none" stroke="currentColor" stroke-width="3"/>'
               '<rect x="30" y="39" width="4" height="9"/>'
               '<rect x="24" y="47" width="16" height="4" rx="2"/>'),
    "rnb": '<path d="M32 49 C13 37 17 19 28 22 C31 23 32 26 32 26 C32 26 33 23 36 22 C47 19 51 37 32 49 Z"/>',
    "electronic": ('<rect x="15" y="30" width="6" height="19" rx="3"/>'
                   '<rect x="25" y="20" width="6" height="29" rx="3"/>'
                   '<rect x="35" y="34" width="6" height="15" rx="3"/>'
                   '<rect x="45" y="26" width="6" height="23" rx="3"/>'),
    "jazz": ('<circle cx="16" cy="15" r="3"/>'
             '<path d="M16 15 C21 12 23 18 25 20 C28 23 29 24 29 28 L29 44 '
             'C29 50 34 53 39 50 C44 47 43 41 41 37" '
             'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
             '<path d="M34 37 L50 24 Q54 33 49 42 Z"/>'),
    "blues": ('<rect x="30" y="12" width="4" height="22"/>'
              '<rect x="27" y="11" width="10" height="4" rx="1"/>'
              '<path fill-rule="evenodd" d="M19 44 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0 Z '
              'M27.5 44 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0 Z"/>'),
    "classical": ('<path fill-rule="evenodd" d="M9 24 a3 3 0 0 1 3 -3 h40 a3 3 0 0 1 3 3 v16 '
                  'a3 3 0 0 1 -3 3 h-40 a3 3 0 0 1 -3 -3 Z '
                  'M22 21 h2 v15 h-2 Z M31 21 h2 v15 h-2 Z M40 21 h2 v15 h-2 Z '
                  'M17 21 h4 v11 h-4 Z M27 21 h4 v11 h-4 Z M37 21 h4 v11 h-4 Z"/>'),
    "country": ('<ellipse cx="32" cy="42" rx="21" ry="5.5"/>'
                '<path d="M23 42 C23 30 26 23 32 23 C38 23 41 30 41 42 Z"/>'),
    "reggae": '<path d="M32 51 C19 46 17 28 32 13 C47 28 45 46 32 51 Z"/>',
    "latin": ('<g transform="rotate(-18 32 32)"><ellipse cx="25" cy="23" rx="7" ry="9"/>'
              '<rect x="23" y="30" width="4" height="15" rx="2"/></g>'
              '<g transform="rotate(18 32 32)"><ellipse cx="39" cy="23" rx="7" ry="9"/>'
              '<rect x="37" y="30" width="4" height="15" rx="2"/></g>'),
    "soundtrack": ('<rect x="14" y="27" width="36" height="21" rx="3"/>'
                   '<path d="M15 23 l6 -1 l1.6 7 l-6 1 Z M24 22 l6 -1 l1.6 7 l-6 1 Z '
                   'M33 21 l6 -1 l1.6 7 l-6 1 Z M42 20 l6 -1 l1.6 7 l-6 1 Z"/>'),
    "vocal": ('<rect x="27" y="13" width="10" height="20" rx="5"/>'
              '<path d="M21 29 a11 11 0 0 0 22 0" fill="none" stroke="currentColor" stroke-width="3"/>'
              '<rect x="30" y="40" width="4" height="7"/>'
              '<rect x="24" y="47" width="16" height="4" rx="2"/>'),
    "newage": ('<path d="M13 25 q6 -6 12 0 t12 0 t13 0" fill="none" stroke="currentColor" stroke-width="3"/>'
               '<path d="M13 33 q6 -6 12 0 t12 0 t13 0" fill="none" stroke="currentColor" stroke-width="3"/>'
               '<path d="M13 41 q6 -6 12 0 t12 0 t13 0" fill="none" stroke="currentColor" stroke-width="3"/>'),
    "world": ('<circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="3"/>'
              '<ellipse cx="32" cy="32" rx="8" ry="18" fill="none" stroke="currentColor" stroke-width="3"/>'
              '<line x1="15" y1="32" x2="49" y2="32" stroke="currentColor" stroke-width="3"/>'
              '<line x1="18" y1="23" x2="46" y2="23" stroke="currentColor" stroke-width="3"/>'
              '<line x1="18" y1="41" x2="46" y2="41" stroke="currentColor" stroke-width="3"/>'),
    "kids": ('<ellipse cx="32" cy="27" rx="13" ry="15"/>'
             '<path d="M32 42 l-2.5 5 h5 z"/>'
             '<path d="M32 47 q5 5 -1 10" fill="none" stroke="currentColor" stroke-width="2"/>'),
    "spoken": ('<path fill-rule="evenodd" d="M18 15 h28 a5 5 0 0 1 5 5 v15 a5 5 0 0 1 -5 5 '
               'h-14 l-9 8 v-8 a5 5 0 0 1 -5 -5 v-15 a5 5 0 0 1 5 -5 Z '
               'M22.4 28 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z '
               'M29.4 28 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z '
               'M36.4 28 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 Z"/>'),
    "acappella": ('<circle cx="28" cy="21" r="8"/>'
                  '<path d="M15 48 C15 38 21 33 28 33 C35 33 41 38 41 48 Z"/>'
                  '<path d="M45 23 a7 7 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="3"/>'
                  '<path d="M48 19 a11 11 0 0 1 0 22" fill="none" stroke="currentColor" stroke-width="3"/>'),
    "anime": ('<path fill-rule="evenodd" d="M17 31 L24 17 L30 28 L34 28 L40 17 L47 31 '
              'C51 45 42 51 32 51 C22 51 13 45 17 31 Z '
              'M23 32 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0 Z '
              'M33 32 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0 Z"/>'),
    "christmas": ('<path d="M32 8 l1.5 3.3 3.6 .4 -2.7 2.4 .7 3.5 -3.1 -1.8 -3.1 1.8 .7 -3.5 -2.7 -2.4 3.6 -.4 z"/>'
                  '<rect x="29" y="46" width="6" height="6"/>'
                  '<path d="M32 14 L23 28 H41 Z M32 23 L19 40 H45 Z M32 32 L16 47 H48 Z"/>'),
    "christian": '<path d="M27 12 h10 v11 h11 v10 h-11 v19 h-10 v-19 h-11 v-10 h11 z"/>',
    "game": ('<ellipse cx="32" cy="47" rx="16" ry="6"/>'
             '<rect x="29" y="24" width="6" height="22"/>'
             '<circle cx="32" cy="19" r="7"/>'),
    "jpop": ('<rect x="11" y="17" width="42" height="5" rx="2"/>'
             '<rect x="16" y="25" width="32" height="4"/>'
             '<rect x="19" y="22" width="5" height="28"/>'
             '<rect x="40" y="22" width="5" height="28"/>'),
    "kpop": ('<circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="2"/>'
             '<path d="M32 14 a18 18 0 0 1 0 36 a9 9 0 0 1 0 -18 a9 9 0 0 0 0 -18 z"/>'),
    "fallback": ('<ellipse cx="25" cy="45" rx="7.5" ry="6"/>'
                 '<rect x="31" y="17" width="3" height="28"/>'
                 '<path d="M34 17 q11 2 11 12 q-4 -7 -11 -6 z"/>'),
}

SVG = ('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" '
       'fill="currentColor">{glyph}</svg>\n')

os.makedirs(WEB, exist_ok=True)
for key, glyph in GLYPHS.items():
    svg = SVG.format(glyph=glyph)
    with open(os.path.join(WEB, f"{key}.svg"), "w") as f:
        f.write(svg)
    iset = os.path.join(IOS, f"genre-{key}.imageset")
    os.makedirs(iset, exist_ok=True)
    with open(os.path.join(iset, f"{key}.svg"), "w") as f:
        f.write(svg)
    contents = {
        "images": [{"filename": f"{key}.svg", "idiom": "universal"}],
        "info": {"author": "xcode", "version": 1},
        "properties": {"preserves-vector-representation": True,
                       "template-rendering-intent": "template"},
    }
    with open(os.path.join(iset, "Contents.json"), "w") as f:
        json.dump(contents, f, indent=2)

print(f"generated {len(GLYPHS)} mono icons -> {WEB} / {IOS}")

if "--preview" not in sys.argv:
    sys.exit(0)

# preview: tinted on light + dark to confirm theme adaptivity
keys = list(GLYPHS)
def row(color, bg):
    cells = "".join(
        f'<div class=c style="color:{color}">'
        f'<div class=r>{SVG.format(glyph=GLYPHS[k]).strip()}'
        f'<span style="width:40px;height:40px;display:inline-block">'
        f'{SVG.replace("64", "40", 2).format(glyph=GLYPHS[k]).strip()}</span></div>'
        f'<div class=l style="color:{color};opacity:.7">{k}</div></div>'
        for k in keys)
    return f'<div class=g style="background:{bg}">{cells}</div>'
html = (
    '<!doctype html><meta charset=utf-8><title>mono genre icons</title>'
    '<style>body{font-family:system-ui;margin:0}'
    '.g{display:flex;flex-wrap:wrap;gap:22px;padding:26px}'
    '.c{display:flex;flex-direction:column;align-items:center;gap:6px;width:92px}'
    '.r{display:flex;align-items:center;gap:10px}.l{font-size:12px}</style>'
    + row("#2b2b2f", "#f3f3f4") + row("#e6e6e8", "#1c1c1e"))
out = os.path.join(tempfile.gettempdir(), "genre-mono-preview.html")
with open(out, "w") as f:
    f.write(html)
print("preview ->", out)
