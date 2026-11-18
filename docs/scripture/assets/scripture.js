/* Scripture reader: progressive enhancement over static, complete HTML.
   Local only: preferences and bookmarks live in localStorage and are never transmitted. */
(function () {
  'use strict';
  var KEY = 'sof.scripture.v1';
  var BOOKS = ['Gen','Exod','Lev','Num','Deut','Josh','Judg','1Sam','2Sam','1Kgs','2Kgs','Isa','Jer','Ezek','Hos','Joel','Amos','Obad','Jonah','Mic','Nah','Hab','Zeph','Hag','Zech','Mal','Ps','Job','Prov','Ruth','Song','Eccl','Lam','Esth','Dan','Ezra','Neh','1Chr','2Chr'];
  var SLUG = { Gen: 'genesis', Exod: 'exodus' };
  var NAME = { Gen: 'Genesis', Exod: 'Exodus' };
  var MARKS = /[\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g; /* keeps maqqef U+05BE, paseq U+05C0, sof pasuq U+05C3 */
  var CANT = /[\u0591-\u05AF\u05BD]/g;
  var LAYERS = ['words', 'context', 'connections', 'remnant'];
  var doc = document, body = doc.body;
  var base = body.getAttribute('data-base') || '';
  doc.documentElement.classList.add('js');

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable: preferences simply do not persist */ } }
  var state = load();
  state.prefs = Object.assign({ hebrew: 'pointed', size: 100, english: true, layers: ['words'] }, state.prefs || {});
  state.bookmarks = state.bookmarks || [];

  function el(tag, attrs, kids) {
    var n = doc.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
    return n;
  }
  function heb(t) { return el('span', { lang: 'he', dir: 'rtl', class: 'hebrew', text: t }); }
  var cache = {};
  function getJSON(path) {
    if (!cache[path]) cache[path] = fetch(base + path).then(function (r) { if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); });
    return cache[path];
  }
  function shardOf(id) { var n = parseInt(id.replace(/^H/, ''), 10); return 'L' + String(Math.floor(n / 300)).padStart(2, '0'); }
  function getLemma(id) { return getJSON('data/lemmas/' + shardOf(id) + '.json').then(function (s) { return s.lemmas[id] || null; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function para(t, cls) { return el('p', { class: cls || '', text: t }); }
  function sec(title, kids, cls, level) { return el('section', { class: 'ps ' + (cls || '') }, [el('h' + (level || 3), { text: title })].concat(kids)); }
  function refLabel(v) { var p = v.split('.'); return NAME[p[0]] + ' ' + p[1] + ':' + p[2]; }

  /* ---------------- display modes ---------------- */
  var current = null, chapterData = null, panel = null, lastFocus = null;
  function applyPrefs() {
    var p = state.prefs;
    body.style.setProperty('--sf-size', p.size + '%');
    body.setAttribute('data-hebrew', p.hebrew);
    body.classList.toggle('hide-english', !p.english);
    body.setAttribute('data-layers', p.layers.join(' '));
    doc.querySelectorAll('.w').forEach(function (w) {
      if (!w.dataset.full) w.dataset.full = w.textContent;
      var t = w.dataset.full;
      if (p.hebrew === 'nocant') t = t.replace(CANT, '');
      else if (p.hebrew === 'consonantal') t = t.replace(MARKS, '');
      w.textContent = t;
    });
  }
  function setPrefs(patch) { Object.assign(state.prefs, patch); save(state); applyPrefs(); syncControls(); if (current) renderPanel(); }

  var ctl = {};
  function buildControls() {
    var host = doc.getElementById('sf-controls');
    if (!host) return;
    var sel = el('select', { id: 'sf-heb', 'aria-label': 'Hebrew display' }, [
      el('option', { value: 'pointed', text: 'Hebrew: pointed with cantillation' }),
      el('option', { value: 'nocant', text: 'Hebrew: pointed, no cantillation' }),
      el('option', { value: 'consonantal', text: 'Hebrew: consonants only' })]);
    sel.addEventListener('change', function () { setPrefs({ hebrew: sel.value }); });
    var eng = el('input', { type: 'checkbox', id: 'sf-eng' });
    eng.addEventListener('change', function () { setPrefs({ english: eng.checked }); });
    var minus = el('button', { type: 'button', 'aria-label': 'Smaller text', text: 'A−' });
    var plus = el('button', { type: 'button', 'aria-label': 'Larger text', text: 'A+' });
    minus.addEventListener('click', function () { setPrefs({ size: Math.max(80, state.prefs.size - 10) }); });
    plus.addEventListener('click', function () { setPrefs({ size: Math.min(160, state.prefs.size + 10) }); });
    var simple = el('button', { type: 'button', id: 'sf-simple', text: 'Simple view' });
    var deep = el('button', { type: 'button', id: 'sf-deep', text: 'Deep study' });
    simple.addEventListener('click', function () { setPrefs({ layers: [] }); closePanel(); });
    deep.addEventListener('click', function () { setPrefs({ layers: LAYERS.slice() }); });
    var lay = el('fieldset', { class: 'layers' }, [el('legend', { text: 'Layers (Read is always on)' })]);
    LAYERS.forEach(function (l) {
      var cb = el('input', { type: 'checkbox', id: 'sf-l-' + l, 'data-layer': l });
      cb.addEventListener('change', function () {
        var cur = state.prefs.layers.filter(function (x) { return x !== l; });
        if (cb.checked) cur.push(l);
        setPrefs({ layers: cur });
        if (!cb.checked && l === 'words') closePanel();
      });
      lay.appendChild(el('label', {}, [cb, ' ' + l.charAt(0).toUpperCase() + l.slice(1)]));
    });
    var bm = el('details', { class: 'bookmarks' }, [el('summary', { text: 'Bookmarks (this browser only)' }), el('ul', { id: 'sf-bm' })]);
    host.appendChild(el('div', { class: 'row' }, [sel, el('label', {}, [eng, ' English']), minus, plus, simple, deep]));
    host.appendChild(lay);
    host.appendChild(bm);
    ctl = { sel: sel, eng: eng };
  }
  function syncControls() {
    if (!ctl.sel) return;
    ctl.sel.value = state.prefs.hebrew;
    ctl.eng.checked = state.prefs.english;
    LAYERS.forEach(function (l) { var c = doc.getElementById('sf-l-' + l); if (c) c.checked = state.prefs.layers.indexOf(l) >= 0; });
    var ul = doc.getElementById('sf-bm');
    if (ul) {
      ul.textContent = '';
      if (!state.bookmarks.length) ul.appendChild(el('li', { text: 'None yet. Use ☆ beside a verse.' }));
      state.bookmarks.forEach(function (v) {
        var p = v.split('.');
        var li = el('li', {}, [el('a', { href: base + SLUG[p[0]] + '/' + pad(p[1]) + '.html#' + v, text: refLabel(v) }), ' ']);
        var rm = el('button', { type: 'button', 'aria-label': 'Remove bookmark ' + v, text: '✕' });
        rm.addEventListener('click', function () { toggleBookmark(v); });
        li.appendChild(rm); ul.appendChild(li);
      });
    }
    doc.querySelectorAll('.bmk').forEach(function (b) {
      var on = state.bookmarks.indexOf(b.dataset.verse) >= 0;
      b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function toggleBookmark(v) {
    var i = state.bookmarks.indexOf(v);
    if (i >= 0) state.bookmarks.splice(i, 1); else state.bookmarks.push(v);
    save(state); syncControls();
  }
  function addVerseTools() {
    doc.querySelectorAll('.verse').forEach(function (v) {
      var id = v.dataset.verse;
      var b = el('button', { type: 'button', class: 'bmk', 'data-verse': id, 'aria-label': 'Bookmark ' + id, 'aria-pressed': 'false', text: '☆' });
      b.addEventListener('click', function () { toggleBookmark(id); });
      var c = el('button', { type: 'button', class: 'cite', 'aria-label': 'Copy link to ' + id, text: '🔗' });
      c.addEventListener('click', function () {
        var url = location.href.split('#')[0] + '#' + id;
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { c.textContent = '✓'; setTimeout(function () { c.textContent = '🔗'; }, 1200); });
        else location.hash = id;
      });
      v.insertBefore(el('div', { class: 'vtools' }, [b, c]), v.firstChild.nextSibling);
    });
  }

  /* ---------------- word study panel ---------------- */
  function selectWord(wid, vid, noHash) {
    if (state.prefs.layers.indexOf('words') < 0) { state.prefs.layers.push('words'); save(state); applyPrefs(); syncControls(); }
    current = { wid: wid, vid: vid };
    doc.querySelectorAll('.w.sel').forEach(function (x) { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); });
    var node = doc.querySelector('.w[data-id="' + wid + '"]');
    if (node) { node.classList.add('sel'); node.setAttribute('aria-pressed', 'true'); }
    state.last = Object.assign(state.last || {}, { verse: vid, word: wid }); save(state);
    if (!noHash) history.replaceState(null, '', '#' + vid + '/' + wid);
    renderPanel();
  }
  function closePanel() {
    current = null; if (panel) panel.hidden = true; body.classList.remove('panel-open');
    doc.querySelectorAll('.w.sel').forEach(function (x) { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); });
    var vid = state.last && state.last.verse; if (vid) history.replaceState(null, '', '#' + vid);
    if (state.last) delete state.last.word; save(state);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function renderPanel() {
    if (!current || !chapterData) return;
    var v = chapterData.verses.filter(function (x) { return x.id === current.vid; })[0]; if (!v) return;
    var w = v.w.filter(function (x) { return x.id === current.wid; })[0]; if (!w) return;
    panel.hidden = false; body.classList.add('panel-open'); panel.textContent = '';
    var L = state.prefs.layers;
    var close = el('button', { type: 'button', class: 'close', text: 'Close ✕' });
    close.addEventListener('click', closePanel);
    panel.appendChild(el('div', { class: 'phead' }, [el('h2', { id: 'ps-title', text: 'Word study' }), close]));
    var surface = w.t.replace(/\//g, '');
    var kids = [
      para('Selected word in ' + refLabel(v.id) + ', word ' + w.i + ' of ' + v.w.length + '.', 'muted'),
      el('p', {}, [heb(surface), ' ', el('small', { text: '(with marks, as in the WLC)' })]),
      el('p', {}, [heb(surface.replace(MARKS, '')), ' ', el('small', { text: '(consonants only)' })]),
      para('Transliteration (mechanical, approximate): ' + w.tr + '. Ancient pronunciation is reconstructed and debated; this is a reading aid, not a claim about how the word was spoken.', 'muted')];
    if (w.k) kids.push(para('Ketiv/qere: this word is written as shown (ketiv)' + (w.q ? ' and read as ' + w.q.t.replace(/\//g, '') + ' (qere), per the WLC marginal note.' : '.')));
    if (w.alt) kids.push(para('The WLC records an alternative accent reading: ' + w.alt.replace(/\//g, '') + '.'));
    panel.appendChild(sec('Original word', kids));
    var holders = [];
    w.p.forEach(function (p) {
      var h = el('div', { class: 'part' }, [el('h4', {}, [heb(p.t), ' ', el('small', { text: p.x })]), para(p.g || 'Morphology not provided', 'gram'), el('p', { class: 'muted' }, ['OSHB morph code: ', el('code', { text: p.m || '—' })])]);
      if (p.lm) { var slot = el('div', { class: 'lemslot', text: 'Loading lexicon…' }); h.appendChild(slot); holders.push({ p: p, slot: slot }); }
      else h.appendChild(para(p.fx ? 'Prefix or particle (' + p.fx + '): carries no separate lexical entry in this dataset.' : 'No lemma is given for this part.', 'muted'));
      panel.appendChild(h);
    });
    var ctx = el('div', { class: 'ctx' }), rem = el('div', { class: 'rem' });
    if (L.indexOf('context') >= 0) panel.appendChild(ctx);
    if (L.indexOf('remnant') >= 0) panel.appendChild(rem);
    panel.setAttribute('aria-labelledby', 'ps-title');
    Promise.all([getJSON('data/context.json'), getJSON('data/remnant/' + current.vid.split('.')[0] + '.json')]).then(function (r) {
      holders.forEach(function (h) { fillLemma(h.slot, h.p, v, r[0]); });
      fillContext(ctx, v, r[0]);
      fillRemnant(rem, v, r[1]);
    }).catch(function () { holders.forEach(function (h) { h.slot.textContent = 'Data could not be loaded. Check your connection and retry.'; }); });
    panel.focus({ preventScroll: true });
  }

  function fillRemnant(host, v, data) {
    host.appendChild(el('h3', { text: 'Remnant (author’s interpretation)' }));
    var blocks = data.verses[v.id];
    if (!blocks) { host.appendChild(para('The preserved manuscript has no passage attached to this verse.', 'muted')); return; }
    host.appendChild(para('Shown unmodified from the preserved manuscript. It is the Scroll’s own reading, not Scripture and not a lexical definition.', 'muted'));
    blocks.forEach(function (b) {
      var ul = el('ul');
      b.lines.filter(function (l) { return l.kind !== 'boilerplate-hebrew-root-note'; }).forEach(function (l) { ul.appendChild(el('li', { text: l.text })); });
      host.appendChild(para(b.file + ', lines ' + b.markerLine + '–' + b.endLine, 'muted')); host.appendChild(ul);
    });
  }
  function fillContext(host, v, ctx) {
    host.appendChild(el('h3', { text: 'Context and interpretive traditions (draft)' }));
    var wp = ctx.wordplay.filter(function (x) { return x.verse === v.id; });
    var tr = ctx.traditions.filter(function (x) { return x.verse === v.id; });
    wp.forEach(function (x) { host.appendChild(el('p', {}, [el('strong', { text: 'Wordplay (' + x.status + '): ' }), x.text])); });
    tr.forEach(function (x) { host.appendChild(el('p', {}, [el('strong', { text: x.source + ' — ' + x.tradition + ' (' + x.status + '): ' }), x.summary, ' ', el('em', { text: x.check || '' })])); });
    if (!wp.length && !tr.length) host.appendChild(para('No wordplay or tradition notes have been entered for this verse. Absence is not a finding.', 'muted'));
    host.appendChild(para('Traditions are shown by period and source and are never presented as one “Hebrew view”. Status “needs-source-check” means the passage has not been verified against an edition in this build.', 'muted'));
  }
  function fillLemma(slot, part, verse, ctx) {
    getLemma(part.lm).then(function (rec) {
      slot.textContent = '';
      if (!rec) { slot.appendChild(para('No lexical record for ' + part.lm + '.', 'muted')); return; }
      slot.appendChild(renderLemma(rec, verse, ctx));
    });
  }

  function renderLemma(rec, verse, ctx) {
    var L = state.prefs.layers, box = el('div', { class: 'lemma' });
    var titleLevel = verse ? 3 : 2, sectionLevel = verse ? 4 : 3;
    var selForVerse = verse ? ctx.selections.filter(function (s) { return s.verse === verse.id && s.lemma === rec.id; }) : [];
    var chosen = {}, alt = {};
    selForVerse.forEach(function (s) { s.senseIds.forEach(function (i) { chosen[i] = s; }); (s.alternativeSenseIds || []).forEach(function (i) { alt[i] = s; }); });
    box.appendChild(el('h' + titleLevel, {}, ['Lemma ', heb(rec.hebrew || (rec.strongs && rec.strongs.hebrew) || rec.id), ' ', el('small', { text: rec.id + (rec.xlit ? ' · ' + rec.xlit : '') })]));
    var ids = ['Strong’s H' + rec.strong];
    if (rec.twot) ids.push('TWOT ' + rec.twot);
    if (rec.bdb) ids.push('BDB entry ' + rec.bdb.entryId);
    if (rec.liId) ids.push('Lexical index ' + rec.liId);
    box.appendChild(para('Identifiers: ' + ids.join(' · ') + (rec.pos ? ' · part of speech ' + rec.pos : '') + '.', 'muted'));
    var rootKids = [];
    if (rec.root) {
      rootKids.push(el('p', {}, ['Lexicon-assigned root: ', heb(rec.root.root)]));
      if (rec.root.members.length) {
        var ul = el('ul', { class: 'compact' });
        rec.root.members.slice(0, 40).forEach(function (m) { ul.appendChild(el('li', {}, [heb(m.hebrew), ' ' + (m.xlit || '') + ' — ' + (m.gloss || '')])); });
        rootKids.push(para('Other lexical entries in this root family (a shared root does not mean identical meaning):', 'muted')); rootKids.push(ul);
      }
    } else rootKids.push(para('No root is recorded for this lemma in the lexicon dataset.', 'muted'));
    box.appendChild(sec('Root', rootKids, '', sectionLevel));
    var sk = [];
    if (!rec.available.bdb || !rec.bdb) {
      sk.push(para('Unavailable: the OSHB BDB dataset has no entry for this lemma. ' + (rec.strongs ? 'Strong’s (1890) gives “' + (rec.strongs.meaning || '') + '” but that is a concordance gloss, not a full definition.' : ''), 'unavail'));
    } else {
      sk.push(para((rec.bdb.crossReference ? 'This BDB entry looks like a cross-reference to another entry. ' : '') + rec.bdb.headline + ' — ' + rec.bdb.senseCount + ' sense record(s) imported from the dataset (' + (rec.bdb.datasetStatus || 'status not given') + '). ' + rec.bdb.datasetNote, 'muted'));
      var source = el('a', {
        href: 'https://github.com/openscriptures/HebrewLexicon/blob/21c9add13bc727d3a951361778e97e3ff7afd1ce/BrownDriverBriggs.xml',
        target: '_blank',
        rel: 'noopener noreferrer',
        text: 'Pinned OSHB Brown–Driver–Briggs XML'
      });
      sk.push(el('p', { class: 'muted' }, [
        'Lexicon citation: Brown–Driver–Briggs (1906), ',
        rec.bdb.cite || ('entry ' + rec.bdb.entryId),
        ' · dataset record ',
        rec.bdb.entryId,
        ' · ',
        source
      ]));
      rec.bdb.senses.forEach(function (s) {
        var tag = chosen[s.id] ? 'Draft selection for this verse' + (chosen[s.id].contested ? ' (contested)' : '') : alt[s.id] ? 'Alternative reading for this verse' : '';
        var d = el('details', { class: 'sense depth' + Math.min(s.depth, 3), open: tag ? 'open' : false, id: s.id.replace(/[^\w.-]/g, '_') }, [
          el('summary', {}, [el('span', { class: 'sn', text: s.n }), ' ' + s.text.slice(0, 120) + (s.text.length > 120 ? '…' : ''), tag ? el('span', { class: 'badge', text: tag }) : null])]);
        d.appendChild(para(s.text));
        d.appendChild(para('Sense ID: ' + s.id + ' · ' + s.level + ' · category: ' + s.category + ' (' + s.categoryBasis + ') · attestation: ' + s.attestation + (s.bdbOccurrenceCount ? ' · BDB count: ' + s.bdbOccurrenceCount : ''), 'muted'));
        if (s.glosses.length) d.appendChild(para('Glosses in source: ' + s.glosses.join(' | '), 'muted'));
        if (s.uncertaintyMarkers.length) d.appendChild(para('Uncertainty markers in source: ' + s.uncertaintyMarkers.join(', '), 'warn'));
        if (s.refs.length) d.appendChild(para('Cited references: ' + s.refs.map(function (r) { return r.label || r.r; }).join('; '), 'muted'));
        else d.appendChild(para('No biblical references are attached to this sense in the dataset.', 'muted'));
        d.appendChild(para('Applicability: a sense attested in the lexicon is not automatically valid in a given verse; it is assessed only where a contextual selection is listed.', 'muted'));
        sk.push(d);
      });
    }
    box.appendChild(sec('All documented meanings', sk, 'senses', sectionLevel));
    var mk = [];
    if (verse) {
      if (selForVerse.length) {
        selForVerse.forEach(function (s) {
          mk.push(para('Draft selection (' + s.status + ', ' + (s.contested ? 'contested' : 'not marked contested') + '): senses ' + s.senseIds.join(', ') + (s.alternativeSenseIds && s.alternativeSenseIds.length ? '; alternatives ' + s.alternativeSenseIds.join(', ') : '') + '.'));
          mk.push(para(s.rationale));
          mk.push(para('Sources: ' + s.citations.map(function (c) { return c.label + (c.check ? ' (' + c.check + ')' : ''); }).join('; '), 'muted'));
        });
      } else mk.push(para('No contextual sense selection has been written for this word in this verse. This site does not decide it; consult the senses above and the verse’s grammar.', 'muted'));
      box.appendChild(sec('Meaning in this verse', mk, 'meaning', sectionLevel));
    }
    var across = ctx.selections.filter(function (s) { return s.lemma === rec.id; });
    if (across.length) {
      var al = el('ul', { class: 'compact' });
      across.forEach(function (s) {
        var p = s.verse.split('.');
        al.appendChild(el('li', {}, [el('a', { href: base + SLUG[p[0]] + '/' + pad(p[1]) + '.html#' + s.verse, text: refLabel(s.verse) }), ' → ' + s.senseIds.join(', ') + (s.contested ? ' (contested)' : '')]));
      });
      box.appendChild(sec('Different contextual senses across passages (drafts)', [al], 'across', sectionLevel));
    }
    if (!verse || L.indexOf('connections') >= 0) box.appendChild(connections(rec, verse, sectionLevel));
    return box;
  }

  function connections(rec, verse, sectionLevel) {
    var kids = [], o = rec.occurrences, flat = o.flat, rows = [];
    for (var i = 0; i < flat.length; i += 3) rows.push([flat[i], flat[i + 1], flat[i + 2]]);
    kids.push(para('Occurrences of this lemma id in the pinned WLC (all 39 books, Hebrew numbering): ' + o.total + '. In this edition (Genesis and Exodus): ' + rec.inEdition.count + '.'));
    var forms = el('ul', { class: 'compact' });
    rec.inEdition.forms.forEach(function (f) { forms.appendChild(el('li', {}, [heb(f.form), ' ×' + f.count + ' · ' + f.morph.map(function (m) { return m.code; }).join(', ')])); });
    kids.push(para('Forms in Genesis and Exodus:', 'muted')); kids.push(forms);
    if (rec.homonyms.length) {
      var hl = el('ul', { class: 'compact' });
      rec.homonyms.forEach(function (h) { hl.appendChild(el('li', {}, [heb(h.hebrew), ' ' + (h.xlit || '') + ' — ' + (h.gloss || '') + (h.lemmaId ? ' (' + h.lemmaId + ')' : '')])); });
      kids.push(para('Distinct lexical entries with the same consonants (homonyms; do not merge):', 'muted')); kids.push(hl);
    }
    var cmp = el('div', { class: 'compare', 'aria-live': 'polite' });
    var lim = 60, ul = el('ul', { class: 'occ' });
    function draw() {
      ul.textContent = '';
      rows.slice(0, lim).forEach(function (r) {
        var b = BOOKS[r[0]], ref = b + '.' + r[1] + '.' + r[2], label = (NAME[b] || b) + ' ' + r[1] + ':' + r[2];
        var li = el('li');
        if (SLUG[b]) {
          li.appendChild(el('a', { href: base + SLUG[b] + '/' + pad(r[1]) + '.html#' + ref, text: label }));
          var cb = el('button', { type: 'button', class: 'mini', text: 'Compare' });
          cb.addEventListener('click', function () { compare(cmp, rec, verse, ref); });
          li.appendChild(doc.createTextNode(' ')); li.appendChild(cb);
        } else li.appendChild(doc.createTextNode(label + ' (Hebrew of this book is not loaded here)'));
        ul.appendChild(li);
      });
      if (rows.length > lim) {
        var more = el('button', { type: 'button', class: 'mini', text: 'Show all ' + rows.length });
        more.addEventListener('click', function () { lim = rows.length; draw(); });
        ul.appendChild(el('li', {}, [more]));
      }
    }
    draw();
    kids.push(ul); kids.push(cmp);
    kids.push(para('Occurrence lists show where the lemma appears. They do not show that the sense is the same in each place; proposed symbolic associations are not listed here.', 'muted'));
    return sec('Connections', kids, 'conn', sectionLevel);
  }
  function compare(host, rec, verse, ref2) {
    var want = verse ? [verse.id, ref2] : [ref2];
    host.textContent = 'Loading…';
    Promise.all(want.map(function (r) { var p = r.split('.'); return getJSON('data/chapters/' + p[0] + '-' + pad(p[1]) + '.json').then(function (c) { return c.verses.filter(function (v) { return v.id === r; })[0]; }); })).then(function (vs) {
      host.textContent = '';
      var grid = el('div', { class: 'cmpgrid' });
      vs.forEach(function (v) {
        var h = el('p', { lang: 'he', dir: 'rtl', class: 'hebrew' });
        v.w.forEach(function (w, i) {
          var hit = w.p.some(function (p) { return p.lm === rec.id; });
          var s = el('span', { class: hit ? 'hit' : '', text: w.t.replace(/\//g, '') + (w.a || []).map(function (a) { return a[1]; }).join('') });
          if (i) h.appendChild(doc.createTextNode(' '));
          h.appendChild(s);
        });
        grid.appendChild(el('div', {}, [el('h4', { text: refLabel(v.id) }), h, el('p', { class: 'eng', text: v.en })]));
      });
      host.appendChild(el('h4', { text: 'Side-by-side comparison (highlighted: ' + rec.id + ')' })); host.appendChild(grid);
    }).catch(function () { host.textContent = 'Could not load the comparison.'; });
  }

  /* ---------------- chapter page boot ---------------- */
  function parseHash() {
    var m = /^#([A-Za-z]+\.\d+\.\d+)(?:\/(\w+))?$/.exec(location.hash);
    return m ? { vid: m[1], wid: m[2] } : null;
  }
  function highlightVerse(vid) {
    doc.querySelectorAll('.verse.target').forEach(function (x) { x.classList.remove('target'); });
    var n = vid && doc.getElementById(vid);
    if (n) n.classList.add('target');
  }
  function initChapter() {
    var book = body.dataset.book, ch = parseInt(body.dataset.chapter, 10);
    panel = doc.getElementById('study'); panel.setAttribute('tabindex', '-1'); panel.setAttribute('role', 'region');
    buildControls(); addVerseTools(); applyPrefs(); syncControls();
    state.last = Object.assign(state.last || {}, { book: book, chapter: ch }); save(state);
    getJSON('data/chapters/' + book + '-' + pad(ch) + '.json').then(function (d) {
      chapterData = d;
      var h = parseHash();
      if (h && h.wid) selectWord(h.wid, h.vid, true);
    }).catch(function () { /* static fallback content remains fully readable */ });
    doc.querySelectorAll('.w').forEach(function (w) {
      w.setAttribute('role', 'button');
      w.setAttribute('tabindex', '0');
      w.setAttribute('aria-pressed', 'false');
      function go(e) { lastFocus = w; selectWord(w.dataset.id, w.closest('.verse').dataset.verse); e.preventDefault(); }
      w.addEventListener('click', go);
      w.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') go(e); });
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && current) closePanel(); });
    window.addEventListener('hashchange', function () {
      var h = parseHash();
      if (h) { highlightVerse(h.vid); state.last = Object.assign(state.last || {}, { verse: h.vid }); save(state); if (h.wid && chapterData) selectWord(h.wid, h.vid, true); }
    });
    var h0 = parseHash();
    if (h0) { highlightVerse(h0.vid); var n = doc.getElementById(h0.vid); if (n) n.scrollIntoView(); }
    else if (state.last && state.last.book === book && state.last.chapter === ch && state.last.verse && doc.getElementById(state.last.verse)) {
      highlightVerse(state.last.verse); doc.getElementById(state.last.verse).scrollIntoView();
    }
  }

  /* ---------------- index + lemma pages ---------------- */
  function plain(s) { return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function initIndex() {
    var lede = doc.querySelector('.sf-index main .lede');
    if (lede && state.last && SLUG[state.last.book]) {
      var s = state.last;
      lede.parentNode.insertBefore(el('p', { class: 'resume' }, ['Continue where you left off: ', el('a', { href: SLUG[s.book] + '/' + pad(s.chapter) + '.html' + (s.verse ? '#' + s.verse + (s.word ? '/' + s.word : '') : ''), text: NAME[s.book] + ' ' + s.chapter + (s.verse ? ':' + s.verse.split('.')[2] : '') }), ' (saved in this browser only)']), lede.nextSibling);
    }
    var q = doc.getElementById('lf-q'), out = doc.getElementById('lf-results'); if (!q) return;
    var idx = null;
    q.addEventListener('input', function () {
      var t = q.value.trim(); out.textContent = ''; if (!t) return;
      (idx ? Promise.resolve(idx) : getJSON('data/lemma-index.json').then(function (d) { idx = d.lemmas; return idx; })).then(function (list) {
        var hq = t.replace(MARKS, ''), isHeb = /[\u0590-\u05FF]/.test(hq), pq = plain(t), num = /^h?\d+[a-z]?$/i.test(t) ? t.replace(/^h/i, '').replace(/[a-z]$/i, '') : null, hits = [];
        for (var i = 0; i < list.length && hits.length < 40; i++) {
          var l = list[i];
          if ((isHeb && (l.h || '').replace(MARKS, '').indexOf(hq) >= 0) || (num && l.s === num) || (!isHeb && !num && (plain(l.x).indexOf(pq) >= 0 || plain(l.g).indexOf(pq) >= 0))) hits.push(l);
        }
        if (!hits.length) out.appendChild(el('li', { text: 'No lemma in Genesis or Exodus matches “' + t + '”.' }));
        hits.forEach(function (l) {
          out.appendChild(el('li', {}, [heb(l.h || l.id), ' ', el('a', { href: 'lemma.html#' + l.id, text: (l.x || l.id) + ' — ' + (l.g || 'no gloss') }), ' ', el('small', { text: l.id + ' · ' + l.n + ' in Gen/Exod · ' + (l.sc ? l.sc + ' BDB sense record(s)' : 'no BDB senses (unavailable)') })]));
        });
      });
    });
  }
  function initLemmaPage() {
    var main = doc.getElementById('lemma-root');
    function draw() {
      var id = (location.hash || '').slice(1); main.textContent = '';
      if (!/^H\d+[a-z]?$/.test(id)) { main.appendChild(para('Choose a lemma from the word finder on the Scripture home page.')); return; }
      Promise.all([getLemma(id), getJSON('data/context.json')]).then(function (r) {
        if (!r[0]) { main.appendChild(para('Lemma not found in this edition.')); return; }
        main.appendChild(el('h2', {}, [heb(r[0].hebrew || id), ' ', el('small', { text: id })]));
        main.appendChild(renderLemma(r[0], null, r[1]));
      });
    }
    window.addEventListener('hashchange', draw); draw();
  }

  function boot() {
    var cls = body.className;
    if (/sf-chapter/.test(cls)) initChapter();
    else if (/sf-index/.test(cls)) initIndex();
    else if (/sf-lemma/.test(cls)) { applyPrefs(); initLemmaPage(); }
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})();
