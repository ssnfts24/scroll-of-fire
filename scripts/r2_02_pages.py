"""Static HTML for the R2-02 Scripture reader (generated; never hand-edited)."""
import html
import re

E = html.escape
HEB_KINDS = {"author-scripture-paraphrase-or-commentary": "Scroll paraphrase / commentary",
             "author-hebrew-note": "Scroll Hebrew note",
             "author-interpretation": "Scroll interpretation",
             "boilerplate-hebrew-root-note": "Repeated Hebrew-root note"}


def word_text(w):
    t = w["t"].replace("/", "")
    for typ, txt in w.get("a", []):
        t += txt
    return t


def head(title, desc, base, canonical_path, extra=""):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{E(desc)}">
<link rel="canonical" href="https://codexofreality.org/{E(canonical_path)}">
<meta name="theme-color" content="#0b0b0f">
<title>{E(title)}</title>
<link rel="stylesheet" href="{base}assets/scripture.css">
<script defer src="{base}../assets/js/site.js"></script>
<script defer src="{base}assets/scripture.js"></script>
{extra}</head>
"""


def masthead(base):
    return f"""<a class="skip-link" href="#main">Skip to content</a>
<header class="sf-mast">
<a class="sf-brand" href="{base}index.html"><span aria-hidden="true">✦</span> Scripture · Genesis &amp; Exodus</a>
<nav data-site-nav aria-label="Scripture navigation"><a href="{base}genesis/01.html">Genesis</a><a href="{base}exodus/01.html">Exodus</a><a href="{base}index.html#lemma-finder">Word finder</a><a href="{base}about.html">Sources &amp; method</a><a href="{base}../scroll/search.html">Scroll Search</a><a href="{base}../scroll/lexicon.html">Hebrew Lexicon</a><a href="{base}../scroll/atlas.html">Reference Atlas</a><a href="{base}../scroll/editorial.html">Evidence Edition</a><a href="{base}../moons.html">13 Moons</a><a href="{base}../codex-atlas.html">Codex Atlas</a><a href="{base}../scroll/index.html">Unsealed Library</a></nav>
</header>
"""


FOOT = """<footer class="sf-foot"><p>Hebrew: Westminster Leningrad Codex via the Open Scriptures Hebrew Bible. Lemma and morphology: OSHB, CC BY 4.0. Lexicon: Brown–Driver–Briggs (1906) as digitised by OSHB. English: World English Bible (public domain). Interpretive layers are drafts and are labelled. <a href="{b}about.html">Sources, licences and limits</a>.</p><p>Reading position and preferences are stored only in this browser (localStorage); nothing is sent anywhere.</p></footer>
"""


def verse_block(v, rem, ctx_by_verse, trad_by_verse):
    vid = v["id"]
    words = ""
    for i, w in enumerate(v["w"]):
        if i and not any(a[0] == "x-maqqef" for a in v["w"][i - 1].get("a", [])):
            words += " "
        words += f'<span class="w" data-id="{E(w["id"])}">{E(word_text(w))}</span>'
    ketiv = [w for w in v["w"] if w.get("k")]
    note = ""
    if v["enNumbering"] != "same" or v["enRef"] != vid:
        note = f'<p class="vnote">English versification differs: this verse is {E(v["enRef"].replace(".", " ", 1).replace(".", ":"))} in most English Bibles.</p>'
    kq = "".join(f'<p class="vnote">Ketiv/qere: written <span lang="he" dir="rtl">{E(w["t"].replace("/", ""))}</span>, read <span lang="he" dir="rtl">{E(w["q"]["t"].replace("/", ""))}</span> (WLC marginal note).</p>' for w in ketiv if w.get("q"))
    rows = []
    for w in v["w"]:
        for p in w["p"]:
            rows.append(f'<tr><td lang="he" dir="rtl">{E(p["t"])}</td><td>{E(p["x"])}</td><td>{E(p.get("lm", "—"))}</td><td>{E(p["m"])}</td><td>{E(p["g"])}</td></tr>')
    table = ('<details class="wtable"><summary>Word-by-word table (all parts)</summary><table><thead><tr><th>Hebrew</th><th>Approx. transliteration</th><th>Lemma</th><th>Morph code</th><th>Parsed</th></tr></thead><tbody>'
             + "".join(rows) + "</tbody></table></details>")
    rem_html = ""
    if rem:
        parts = []
        for b in rem:
            lines = [l for l in b["lines"] if l["kind"] != "boilerplate-hebrew-root-note"]
            nb = len(b["lines"]) - len(lines)
            li = "".join(f'<li><span class="lk">{E(HEB_KINDS[l["kind"]])}</span> {E(l["text"])} <small>(line {l["line"]})</small></li>' for l in lines)
            if nb:
                li += f'<li class="boiler">{nb} repeated Hebrew-root note line(s) omitted here; they remain in the archival file.</li>'
            parts.append(f'<p class="srcline">{E(b["file"])} lines {b["markerLine"]}–{b["endLine"]} (marker {E(b["manuscriptRef"])}, {E(b["manuscriptNumbering"])} numbering)</p><ul>{li}</ul>')
        rem_html = '<details class="layer layer-remnant"><summary>Remnant: the Scroll’s own words beside this verse</summary><p class="layer-note">Author’s interpretation, shown unmodified from the preserved manuscript. It is not Scripture and not a lexical claim.</p>' + "".join(parts) + "</details>"
    ctx = ""
    items = ctx_by_verse.get(vid, [])
    tr = trad_by_verse.get(vid, [])
    if items or tr:
        c = "".join(f'<li><strong>{E(s["lemma"])}</strong> ({E(s["status"])}{"; contested" if s["contested"] else ""}): {E(s["rationale"])}</li>' for s in items)
        c += "".join(f'<li><strong>{E(t["source"])}</strong> — {E(t["tradition"])} ({E(t["status"])}): {E(t["summary"])} <em>{E(t.get("check", ""))}</em></li>' for t in tr)
        ctx = f'<details class="layer layer-context"><summary>Context notes for this verse (draft, unreviewed)</summary><ul>{c}</ul></details>'
    return f"""<article class="verse" id="{vid}" data-verse="{vid}">
<a class="vnum" href="#{vid}" aria-label="Verse {v['n']} link">{v['n']}</a>
<div class="vbody">
<p class="heb" lang="he" dir="rtl">{words}</p>
<p class="eng" lang="en">{E(v['en'])}</p>
{note}{kq}{ctx}{rem_html}{table}
</div></article>
"""


def render_all(OUT, emit_text, books_meta, chapters, manifest, remnant, curated, lemma_index):
    ctx_by_verse, trad_by_verse = {}, {}
    for s in curated["selections"]:
        ctx_by_verse.setdefault(s["verse"], []).append(s)
    for t in curated["traditions"]:
        trad_by_verse.setdefault(t["verse"], []).append(t)
    for bm in books_meta:
        o, slug, n = bm["osis"], bm["slug"], bm["chapters"]
        for ci in range(1, n + 1):
            vs = chapters[(o, ci)]
            note = curated["chapterNotes"].get(f"{o}.{ci}")
            note_html = ""
            if note:
                def ul(k):
                    return "".join(f"<li>{E(x)}</li>" for x in note.get(k, []))
                deb = "".join(f'<li><strong>{E(d["question"])}</strong><ul>' + "".join(f'<li>{E(v["view"])} <em>({E(v["attribution"])})</em></li>' for v in d["views"]) + "</ul></li>" for d in note.get("debates", []))
                note_html = f'<details class="layer layer-context chapter-note" open><summary>Context: {E(note["headline"])} (draft, unreviewed)</summary><h3>Literary observations</h3><ul>{ul("literary")}</ul><h3>Background</h3><ul>{ul("context")}</ul>' + (f"<h3>Where interpreters differ</h3><ul>{deb}</ul>" if deb else "") + "</details>"
            prev = f"{ci - 1:02d}.html" if ci > 1 else None
            nxt = f"{ci + 1:02d}.html" if ci < n else None
            if ci == 1 and o == "Exod":
                prev = "../genesis/50.html"
            if ci == n and o == "Gen":
                nxt = "../exodus/01.html"
            chips = "".join(f'<a href="{c:02d}.html"{" aria-current=page" if c == ci else ""}>{c}</a>' for c in range(1, n + 1))
            pn = ('<nav class="pn" aria-label="Chapter navigation">' + (f'<a rel="prev" href="{prev}">← Previous chapter</a>' if prev else "<span></span>") + (f'<a rel="next" href="{nxt}">Next chapter →</a>' if nxt else "<span></span>") + "</nav>")
            body = "".join(verse_block(v, remnant[o].get(v["id"]), ctx_by_verse, trad_by_verse) for v in vs)
            page = head(f"{bm['name']} {ci} — Scripture · Scroll of Fire", f"{bm['name']} chapter {ci}: Hebrew (WLC), English (WEB), word study, context and the Scroll's own commentary kept separate.", "../", f"scripture/{slug}/{ci:02d}.html")
            page += f"""<body class="sf-chapter" data-book="{o}" data-chapter="{ci}" data-chapters="{n}" data-base="../">
{masthead('../')}
<main id="main">
<h1>{bm['name']} {ci}</h1>
<p class="edition">Hebrew: WLC (OSHB) · English: World English Bible · {len(vs)} verses (Hebrew numbering)</p>
<div id="sf-controls" class="controls" data-enhance></div>
<noscript><p class="nojs">JavaScript is off: all text, per-verse word tables, context notes and the Scroll’s commentary remain available below. Display-mode switches, the word study panel and bookmarks need JavaScript.</p></noscript>
<nav class="chips" aria-label="{bm['name']} chapters">{chips}</nav>
{pn}
{note_html}
<div class="layout"><section id="text" class="text" aria-label="{bm['name']} {ci} text">
{body}</section>
<aside id="study" class="study" aria-label="Word study panel" hidden></aside></div>
{pn}
</main>
{FOOT.format(b='../')}</body>
</html>
"""
            emit_text(f"docs/scripture/{slug}/{ci:02d}.html", page)

    t = manifest["totals"]
    c = manifest["completeness"]
    cards = ""
    for bm in books_meta:
        chips = "".join(f'<a href="{bm["slug"]}/{i:02d}.html">{i}</a>' for i in range(1, bm["chapters"] + 1))
        cards += f'<section class="bookcard" id="{bm["slug"]}"><h2>{bm["name"]}</h2><p>{bm["chapters"]} chapters · {sum(bm["verseCounts"])} verses</p><nav class="chips" aria-label="{bm["name"]} chapters">{chips}</nav></section>'
    index = head("Genesis & Exodus Scripture — Scroll of Fire", "Read Genesis 1–50 and Exodus 1–40 in Hebrew with word study, context and the Scroll's commentary kept separate.", "", "scripture/index.html")
    index += f"""<body class="sf-index" data-base="">
{masthead('')}
<main id="main">
<h1>Genesis &amp; Exodus, in the original Hebrew</h1>
<p class="lede">Complete Westminster Leningrad Codex text for Genesis 1–50 and Exodus 1–40 with a public-domain English translation, a word-by-word study of every Hebrew word, and the Scroll’s own commentary kept visibly apart from the Scripture.</p>
<p class="draft">Draft checkpoint: Hebrew text, lemma and morphology are imported from OSHB; contextual interpretations are unreviewed drafts. See <a href="about.html">Sources &amp; method</a>.</p>
<div class="books">{cards}</div>
<section id="lemma-finder" class="finder" aria-labelledby="lf-h"><h2 id="lf-h">Word finder</h2>
<p>Search lemmas that occur in Genesis or Exodus by Hebrew (with or without vowels), transliteration, Strong’s number or English gloss. Needs JavaScript.</p>
<label for="lf-q">Find a word</label> <input id="lf-q" type="search" autocomplete="off" placeholder="e.g. רוח, ruach, 7307, spirit"><ul id="lf-results" aria-live="polite"></ul>
<p>Open the <a href="lemma.html">lemma study directory</a> for detailed lexical records, or browse the <a href="about.html">source and method notes</a>.</p>
<p class="hint">Examples: <a href="genesis/01.html#Gen.1.2">ruach (Gen 1:2)</a>, <a href="genesis/02.html#Gen.2.7">nephesh (Gen 2:7)</a>, <a href="genesis/01.html#Gen.1.26">tzelem (Gen 1:26)</a>, <a href="genesis/06.html#Gen.6.4">nephilim (Gen 6:4)</a>.</p></section>
<section aria-labelledby="layers-h"><h2 id="layers-h">Five layers</h2><dl>
<dt>Read</dt><dd>Hebrew and English, uncluttered.</dd><dt>Words</dt><dd>Select any Hebrew word for its grammar and every sense in the lexicon dataset.</dd>
<dt>Context</dt><dd>Literary and historical notes, Jewish and Christian interpretive traditions, where interpreters differ. All drafts.</dd>
<dt>Connections</dt><dd>Every occurrence of a lemma, homonyms and same-root words; compare two passages side by side.</dd>
<dt>Remnant</dt><dd>The Scroll’s own commentary, shown as interpretation.</dd></dl>
<p>Counts: {t['chapters']} chapters, {t['verses']} verses, {t['wordTokens']} Hebrew words, {t['distinctLemmasInEdition']} lemmas; reviewed contextual interpretations: {c['level3_reviewedContext']['reviewedSelections']}.</p></section>
</main>
{FOOT.format(b='')}</body>
</html>
"""
    emit_text("docs/scripture/index.html", index)

    lex = c["level2_lexicalSenses"]
    about = head("Sources, licences and limits — Scripture · Scroll of Fire", "Pinned sources, licences, versification, completeness levels and limits of the Genesis & Exodus Scripture edition.", "", "scripture/about.html")
    about += f"""<body class="sf-about" data-base="">
{masthead('')}
<main id="main">
<h1>Sources, licences and limits</h1>
<h2>Three completeness levels</h2>
<table><thead><tr><th>Level</th><th>Status</th><th>Detail</th></tr></thead><tbody>
<tr><td>1. Original word and morphology</td><td>{E(c['level1_originalWordAndMorphology']['status'])}</td><td>{t['wordTokens']} words and {t['wordParts']} word parts imported from OSHB and machine-compared to the pinned source files by the validation suite; no independent scholarly collation is claimed.</td></tr>
<tr><td>2. Lexical senses</td><td>{E(lex['status'])}</td><td>{lex['lemmasWithSenses']} of {t['distinctLemmasInEdition']} lemmas have BDB entries in the OSHB dataset ({t['senseRecords']} sense records); {len(lex['lemmasWithoutSenses'])} show an unavailable state. The OSHB BDB file is a work-in-progress digitisation, so senses are limited to what it contains.</td></tr>
<tr><td>3. Reviewed contextual interpretation</td><td>{E(c['level3_reviewedContext']['status'])}</td><td>{c['level3_reviewedContext']['draftSelections']} draft selections; 0 reviewed. No chapter is labelled linguistically verified.</td></tr></tbody></table>
<h2>Sources</h2><ul>
<li>Westminster Leningrad Codex (WLC), lemma and morphology: Open Scriptures Hebrew Bible, commit dated 2024-08-27 (<a href="https://github.com/openscriptures/morphhb/tree/{E(manifest['repos']['morphhb']['commit'])}">pinned source edition</a>; exact commit <code>{E(manifest['repos']['morphhb']['commit'])}</code>). Attribution: “Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb”. WLC text is public domain; OSHB data layer is <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</li>
<li>Morphology code legend: Open Scriptures Hebrew Bible, <a href="https://github.com/openscriptures/morphhb/blob/{E(manifest['repos']['morphhb']['commit'])}/parsing/HebrewMorphologyCodes.html"><code>parsing/HebrewMorphologyCodes.html</code></a> at that pinned commit. The displayed parses mechanically decode OSHB codes; unrecognized codes remain explicitly marked.</li>
<li>Lexicon: Brown–Driver–Briggs (1906, public domain) and Strong’s, with OSHB mapping/digitisation from HebrewLexicon at the commit dated 2019-09-02 (<a href="https://github.com/openscriptures/HebrewLexicon/tree/{E(manifest['repos']['hebrewlexicon']['commit'])}">pinned source edition</a>; exact commit <code>{E(manifest['repos']['hebrewlexicon']['commit'])}</code>). Each BDB panel gives the lexicon citation and dataset record ID.</li>
<li>English: World English Bible, published by eBible.org and public domain per the included notice. The pinned copy is from <a href="https://github.com/TehShrike/world-english-bible/tree/{E(manifest['repos']['web']['commit'])}">TehShrike/world-english-bible</a>, commit dated 2025-11-24 (exact commit <code>{E(manifest['repos']['web']['commit'])}</code>). Its <a href="https://github.com/TehShrike/world-english-bible/blob/{E(manifest['repos']['web']['commit'])}/html/copyright.htm">copyright notice</a> says the files were generated 2017-06-14 from source files dated 2017-06-14. eBible.org was unreachable during acquisition; this copy has not been independently compared with the publisher’s edition, so publisher-edition fidelity remains unverified.</li></ul>
<p>File checksums are in <code>sources/r2-02/SOURCES.json</code>; reports are in <code>site-audit/r2-02/</code>.</p>
<h2>Limits</h2><ul>
<li>Versification: Hebrew (WLC) numbering is used; where English Bibles number differently (e.g. Gen 32, Exod 8) the verse shows the English reference.</li>
<li>No MT other than WLC, no Septuagint, Dead Sea Scrolls or Samaritan text is loaded. The reader does not assert variants from those witnesses; tradition notes citing them are marked “needs-source-check”.</li>
<li>Transliteration is mechanical and approximate (it does not distinguish every shewa or qamets). Ancient pronunciation is reconstructed and debated.</li>
<li>Consonantal display hides vowel and cantillation marks visually; the underlying text is unchanged. No Paleo-Hebrew view is offered.</li>
<li>The word-by-word tables list every word part with its OSHB lemma and morphology code.</li>
<li>Occurrence lists are references only; the Hebrew of other books is not loaded here.</li></ul>
<h2>Privacy</h2><p>Your place, display preferences and bookmarks are stored in this browser’s localStorage only and are never transmitted.</p>
</main>
{FOOT.format(b='')}</body>
</html>
"""
    emit_text("docs/scripture/about.html", about)

    lem = head("Lemma study — Scripture · Scroll of Fire", "Every documented sense, occurrence and homonym for a Hebrew lemma found in Genesis or Exodus.", "", "scripture/lemma.html")
    lem += f"""<body class="sf-lemma" data-base="">
{masthead('')}
<main id="main">
<h1>Lemma study</h1>
<div id="lemma-root"><p>Choose a lemma from the word finder on the Scripture home page.</p></div>
<noscript><p class="nojs">This page needs JavaScript to show the detailed lexical records. The chapter pages contain complete Hebrew and English text plus a static word-by-word table with lemma ids and morphology for every verse.</p></noscript>
</main>
{FOOT.format(b='')}</body>
</html>
"""
    emit_text("docs/scripture/lemma.html", lem)
