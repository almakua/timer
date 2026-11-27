# Plan: fade the end image edges into black

Follow up: the gray speed lines end with hard straight edges (top, right) and the figure is cut horizontally at the bottom. Fade them into black inside the image so nothing rectangular is visible

## Steps

1. Reuse the scratchpad venv and `proc.py` (scratchpad dir in the prompt). Work on a copy, eg `fade.py`, starting from `end_image.jpeg` so the original silhouette mask is available. Reapply the manual fix of the previous step: the small white triangle near x 395-430, y 690-760 (800px coords) must end up black

2. Speed lines fade: for pixels outside the figure silhouette (figure + green lettering + green speech marks + dark green angry marks), multiply brightness by a factor that goes from 1 in the inner area to 0 at the line ends. Use distance from the image center or from the edge of the line area (the rectangle where gray lines exist), with a smooth curve (smoothstep), starting the fade roughly 20-25% before the edges. Goal: no visible straight edge where lines stop

3. Bottom fade: apply a vertical gradient on the whole image over the bottom ~20% of the artwork (ending where the figure is cut, around y 1380-1470 in source coords), going to pure black at the cut line, smoothstep. Also fade the left edge of the figure (it touches x ~33) over ~5% so the vertical cut doesn't show either

4. Green elements (lettering top right, "FINEEE!", green speech marks, angry marks) stay untouched by step 2; step 3 may affect them only if they fall in the bottom band

5. Output 800x800, `cwebp -q 82` to `end-image.webp`; also save `preview.png` in the scratchpad. Inspect visually, iterate until no straight edge or white residue is visible

6. `sw.js`: bump `CACHE_NAME` to `v12`. No CSS changes

## Verify

- `npm test` passes
- report preview path and the fade parameters used
