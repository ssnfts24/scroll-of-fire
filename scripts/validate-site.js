#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');
const pages = ['index.html', 'moons.html'];
const requiredOutputs = ['moon-name','moon-day','year-day','visible-phase','illumination','week-gate','shabbat-state','sunset','mirror-title'];
const errors = [];
const read = file => fs.readFileSync(path.join(docs, file), 'utf8');
const localPathExists = url => { const clean = url.split('?')[0].split('#')[0]; if (/^(https?:)?\/\//.test(clean) || clean.startsWith('mailto:')) return true; return fs.existsSync(path.join(docs, clean)); };
const collectAttributeValues = (source, tagPattern, attr) => [...source.matchAll(new RegExp(`<${tagPattern}[^>]*\\s${attr}="([^"]+)"`, 'g'))].map(match => match[1]);
const countToken = (source, token) => source.split(token).length - 1;
function walk(dir) { return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes:true }).flatMap(entry => { const target = path.join(dir, entry.name); return entry.isDirectory() ? walk(target) : [target]; }) : []; }
function validateFileReferences(page, source) { collectAttributeValues(source, 'link', 'href').forEach(href => { if (!localPathExists(href)) errors.push(`${page}: missing stylesheet or link target ${href}`); }); collectAttributeValues(source, 'script', 'src').forEach(src => { if (!localPathExists(src)) errors.push(`${page}: missing script ${src}`); }); collectAttributeValues(source, 'img', 'src').forEach(src => { if (!localPathExists(src)) errors.push(`${page}: missing image ${src}`); }); }
function validateIds(page, source) { const ids = collectAttributeValues(source, '[^\\s>]+', 'id'); const seen = new Map(); ids.forEach(id => seen.set(id, (seen.get(id) || 0) + 1)); [...seen.entries()].forEach(([id, count]) => { if (count > 1) errors.push(`${page}: duplicate id ${id}`); }); }
function validateLegacyReferences(page, source) { const forbidden = page === 'index.html' ? ['home.css','superlayout.css','bridge.css','moons.css','themes.moons.css','calendar-cor.js','living-codex.js'] : ['home.css','home-rebuild.css','superlayout.css','bridge.css','moons.css','themes.moons.css','calendar-cor.js','living-codex.js','moons.js','astrology.js','moons-images.js','pwa-install.js']; forbidden.forEach(token => { if (source.includes(token)) errors.push(`${page}: forbidden legacy dependency ${token}`); }); if (source.includes('archive/pre-rebuild-')) errors.push(`${page}: must not reference archived pre-rebuild files`); }
function validateControllerCounts(page, source) { const expected = page === 'index.html' ? [['assets/js/navigation.js', 1], ['assets/js/pwa.js', 1], ['assets/js/home.js', 1], ['https://www.googletagmanager.com/gtag/js?id=G-4EPTLXGS0M', 1]] : [['assets/js/navigation.js', 1], ['assets/js/pwa.js', 1], ['assets/js/moons-app.js', 1], ['https://www.googletagmanager.com/gtag/js?id=G-4EPTLXGS0M', 1]]; expected.forEach(([token, count]) => { if (countToken(source, token) !== count) errors.push(`${page}: expected ${count} instance of ${token}`); }); }
function validateDocsArchive() { walk(path.join(docs, 'archive')).forEach(file => { if (/\.(html|js)$/i.test(file)) errors.push(`docs archive must not contain production html/js: ${path.relative(root, file)}`); }); }
pages.forEach(page => { const source = read(page); validateFileReferences(page, source); validateIds(page, source); validateLegacyReferences(page, source); validateControllerCounts(page, source); });
validateDocsArchive();
const moonsSource = read('moons.html');
const tabs = [...moonsSource.matchAll(/role="tab"[^>]*aria-controls="([^"]+)"/g)].map(match => match[1]);
tabs.forEach(panelId => { if (!new RegExp(`id="${panelId}"[^>]*role="tabpanel"`).test(moonsSource) && !new RegExp(`role="tabpanel"[^>]*id="${panelId}"`).test(moonsSource)) errors.push(`moons.html: missing tab panel for ${panelId}`); });
requiredOutputs.forEach(name => { if (!moonsSource.includes(`data-moon-output="${name}"`)) errors.push(`moons.html: missing required output ${name}`); });
const manifest = JSON.parse(fs.readFileSync(path.join(docs, 'manifest.webmanifest'), 'utf8')); manifest.icons.forEach(icon => { if (!fs.existsSync(path.join(docs, icon.src))) errors.push(`manifest missing icon ${icon.src}`); });
if (!fs.existsSync(path.join(docs, 'service-worker.js'))) errors.push('missing docs/service-worker.js');
if (errors.length) { console.error('Site validation failed:'); errors.forEach(error => console.error(`- ${error}`)); process.exit(1); }
console.log('Site validation passed.');
