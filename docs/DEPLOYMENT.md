# CodexOfReality.org — Deployment Guide

## GitHub Pages Source
- Branch: main
- Folder: /docs
- Custom domain: codexofreality.org

## CNAME
The file `docs/CNAME` contains `codexofreality.org`.
GitHub Pages reads this to configure the custom domain.

## .nojekyll
`docs/.nojekyll` exists to disable Jekyll processing so files beginning with _ are served correctly.

## Deployment Workflow
The site deploys automatically when changes are pushed to main.
GitHub Pages serves directly from the /docs folder.
There is no build step — all files are pre-built static HTML/CSS/JS.

## Deployment Marker
Each HTML file contains a hidden comment: <!-- build: YYYYMMDD-NN -->
Update this when making significant changes to verify the deployed version.

## Service Worker Cache Versioning
The service worker at `docs/service-worker.js` uses a versioned cache name.
When making significant changes to CSS/JS/HTML:
1. Update CACHE_VERSION in docs/service-worker.js
2. Update version query strings on CSS/JS links in moons.html
3. This forces browsers to download fresh files

## PWA Testing
- Open https://codexofreality.org/ in Chrome
- DevTools > Application > Manifest — verify manifest loads
- DevTools > Application > Service Workers — verify SW is registered
- For iPhone: use Safari > Share > Add to Home Screen

## Verifying Deployed HTML is Current
1. View page source at https://codexofreality.org/
2. Look for <!-- build: YYYYMMDD-NN --> near </head>
3. Compare with docs/index.html in the repository

## Recovering from a Stale Service Worker
1. Open DevTools > Application > Service Workers
2. Click "Unregister" on the active service worker
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
4. Or: update CACHE_VERSION in service-worker.js and push

## Asset Path Conventions
- Custom domain (codexofreality.org): use root-relative paths: /assets/...
- GitHub Pages subdirectory: use relative paths from base href
- The <base href=""> tag is adjusted dynamically in JS for github.io subdirectory hosting
- All asset paths in HTML should be relative (assets/...) to work with the base href system

## GitHub Settings Required
1. Go to Repository Settings > Pages
2. Set Source: Deploy from a branch
3. Branch: main, Folder: /docs
4. Set Custom domain: codexofreality.org
5. Enable "Enforce HTTPS"
