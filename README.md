# RayTree

Interactive family tree built from the Ray GEDCOM export.

## Project structure

- `index.html` – entry point for the website UI.
- `styles.css` – glassmorphism-inspired theme, responsive layout, and cards.
- `script.js` – vanilla JavaScript GEDCOM parser plus UI bindings.
- `data/ray-family-tree.ged` – raw GEDCOM from Ancestry (keep private if desired).

## Local development

Serve the folder with any static server (VS Code Live Server, `python -m http.server`, etc.) so that `fetch` can load the GEDCOM file, then open `http://localhost:8000` (or your tool's URL) to explore the tree.
