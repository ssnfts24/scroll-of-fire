/* ==========================================================================
   Scroll of Fire — Codex of Reality
   codex.css v2.0  (Electric–Aetheric • High Motion • Balanced Perf)
   - Seven-spectrum theme • Living plasma hero • Particle network
   - Responsive grid • Cards • Math blocks • Tabs • HUD • A11y
   - Motion/data fallbacks • Print-safe • Safe-area aware
   ========================================================================== */

/* ------------------------------ Root / Theme ------------------------------ */
:root{
  /* Core palette */
  --bg:#09090d; --bg-elev:#0d0d12; --ink:#eae7df; --muted:#b8b3a6; --line:#262732; --card:#111119;

  /* Seven-spectrum resonance (R→V + near-UV proxy glow) */
  --spec-red:#ff6b6b;
  --spec-orange:#ff9d57;
  --spec-gold:#f3c97a;
  --spec-green:#7cffb2;
  --spec-cyan:#7af3ff;
  --spec-blue:#7aa8ff;
  --spec-violet:#c09cff;
  --spec-uv:rgba(200,140,255,.85); /* visual proxy for UV */

  /* Accents (legacy aliases) */
  --gold:var(--spec-gold);
  --accent:var(--spec-cyan);
  --accent-2:var(--spec-blue);
  --accent-3:var(--spec-green);

  /* Ambient glows */
  --glow-gold:0 0 18px rgba(243,201,122,.26);
  --glow-cyan:0 0 18px rgba(122,243,255,.22);
  --glow-blue:0 0 18px rgba(122,168,255,.18);
  --glow-uv:0 0 22px rgba(200,140,255,.26);

  /* Layout & radii */
  --maxw:1180px; --radius-xl:22px; --radius-lg:18px; --radius-md:14px; --radius-sm:10px; --pad-card:16px;

  /* Type scale */
  --fs-00:12px; --fs-0:14px; --fs-1:16px; --fs-2:18px;
  --fs-3:clamp(20px,2.6vw,24px); --fs-4:clamp(24px,3.6vw,32px); --fs-5:clamp(28px,4.8vw,48px);

  /* Motion */
  --ease:cubic-bezier(.22,.7,.2,1); --ease-slow:cubic-bezier(.22,.55,.08,1);
  --dur-1:.22s; --dur-2:.6s; --dur-3:1.2s;

  /* Hero defaults */
  --hero-aspect:16/9;
  --hero-focal-mobile:60% 50%; --hero-focal-desktop:58% 50%;
  --pulse-opacity:.18; --pulse-c1:rgba(122,243,255,.35); --pulse-c2:rgba(243,201,122,.28);

  /* Parallax hooks (set via JS) */
  --parallax-x:0deg; --parallax-y:0deg; --parallax-zoom:1;

  /* Safe-area */
  --safe-top:env(safe-area-inset-top,0px); --safe-bottom:env(safe-area-inset-bottom,0px);

  /* Focus ring */
  --ring: rgba(122,243,255,.95);
  --ring-outer: rgba(122,243,255,.15);
  --ring-inset: rgba(122,168,255,.35);
}
@media (prefers-color-scheme: light){
  :root{ --ink:#0e1016; --muted:#3c4150; --bg:#f6f7fb; --bg-elev:#ffffff; --card:#f7f8fb; --line:#dfe2ea }
}

/* ------------------------------ Reset & Base ------------------------------ */
*,*::before,*::after{ box-sizing:border-box }
html,body{ height:100% }
html{ -webkit-text-size-adjust:100%; text-size-adjust:100%; color-scheme:dark light; scroll-behavior:smooth }
body{
  margin:0; font:400 var(--fs-1)/1.6 Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Apple Color Emoji","Segoe UI Emoji";
  background:var(--bg); color:var(--ink); overflow-x:hidden; padding-bottom:var(--safe-bottom);
  background-image:
    radial-gradient(1100px 700px at 58% -8%, rgba(122,243,255,.06), transparent 60%),
    radial-gradient(1600px 900px at 20% 10%, rgba(200,140,255,.06), transparent 65%),
    linear-gradient(180deg,#0a0a0e 0%, #0a0a0d 40%, #0b0b10 100%);
  text-rendering:optimizeLegibility; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;
  overscroll-behavior-y:contain;
}
@media (prefers-color-scheme: light){
  body{
    background-image:
      radial-gradient(1200px 600px at 50% -5%, rgba(122,168,255,.08), transparent 60%),
      linear-gradient(180deg,#ffffff 0%, #f6f7fb 100%);
  }
}

::selection{ background:rgba(122,243,255,.25); color:var(--ink) }
:focus-visible{
  outline:2px solid var(--ring);
  box-shadow:0 0 0 4px var(--ring-outer), 0 0 0 1px var(--ring-inset) inset;
  outline-offset:2px; border-radius:10px;
}

/* Links */
a{ color:var(--ink); text-underline-offset:2px; transition:color var(--dur-1) var(--ease), text-shadow var(--dur-1) var(--ease) }
a:hover{ color:#fff; text-shadow:0 0 10px rgba(122,243,255,.35) }
a:focus-visible{ text-decoration:underline }

/* Utils */
.sr-only{ position:absolute!important; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0 }
.center{ text-align:center } .right{ text-align:right } .nowrap{ white-space:nowrap }
.hidden{ display:none !important }
.kbd{ background:#11131a; border:1px solid #343842; border-bottom-width:3px; padding:.15em .4em; border-radius:6px; box-shadow:inset 0 -2px 0 rgba(0,0,0,.25); font-family:ui-monospace,Menlo,Consolas,monospace }

/* ------------------------------ Header / Nav ------------------------------ */
header.site{
  position:sticky; top:0; z-index:70; padding-top:var(--safe-top);
  background:rgba(11,11,15,.72);
  backdrop-filter:saturate(140%) blur(10px);
  -webkit-backdrop-filter:saturate(140%) blur(10px);
  border-bottom:1px solid #1f2029; transition:background var(--dur-1) var(--ease), box-shadow var(--dur-1) var(--ease);
}
header.site.is-stuck{ background:rgba(11,11,15,.82); box-shadow:0 6px 18px rgba(0,0,0,.35) }
.nav{ display:flex; align-items:center; justify-content:space-between; gap:10px; max-width:var(--maxw); margin:0 auto; padding:10px 16px }
.brand{ display:flex; gap:10px; align-items:center }
.brand .logo{ width:28px; height:28px; border-radius:8px; background:conic-gradient(from 210deg, var(--spec-cyan), var(--spec-gold), var(--spec-violet)); box-shadow:inset 0 0 12px rgba(122,243,255,.35), 0 0 18px rgba(200,140,255,.18) }
.brand .kicker{ margin:0; font:800 clamp(18px,3.6vw,22px)/1 "Crimson Pro",Georgia,serif }

.quick{
  display:flex; align-items:center; gap:10px; flex:1 1 auto; justify-content:flex-end;
  overflow-x:auto; overflow-y:hidden; padding:4px 2px 6px; scrollbar-gutter:stable;
  -webkit-overflow-scrolling:touch; scroll-snap-type:x proximity;
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,0)); border-radius:12px;
}
.quick a,.quick button{
  appearance:none; border:1px solid var(--line); background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005));
  color:var(--ink); padding:0 12px; height:36px; line-height:34px; border-radius:10px; font:600 14px/1 Inter; cursor:pointer; text-decoration:none;
  scroll-snap-align:start; position:relative; overflow:hidden;
}
/* ripple hover */
.quick a::before,.quick button::before{
  content:""; position:absolute; inset:auto; width:0; height:0; border-radius:999px; transform:translate(-50%,-50%);
  background:radial-gradient(closest-side, rgba(122,243,255,.25), transparent 70%);
  opacity:0; pointer-events:none; transition:opacity .35s var(--ease);
}
.quick a:hover::before,.quick button:hover::before{ opacity:1 }
.quick a:hover,.quick button:hover{ border-color:#3a3a44 }
@media (max-width:540px){ .quick a,.quick button{ height:34px; line-height:32px; padding:0 10px; font-size:13px } }

/* ------------------------------ Wrapper & Titles ------------------------------ */
.wrap{ max-width:var(--maxw); margin:0 auto; padding:16px 16px calc(80px + var(--safe-bottom)) }
.title{
  font-family:"Crimson Pro",Georgia,serif; font-weight:800; text-align:center; font-size:var(--fs-5);
  margin:8px 0 4px; letter-spacing:.3px;
  background:linear-gradient(90deg, var(--spec-cyan), var(--spec-gold), var(--spec-violet));
  -webkit-background-clip:text; background-clip:text; color:transparent;
  text-shadow:0 0 24px rgba(122,243,255,.18), 0 0 28px rgba(200,140,255,.16);
  animation:titleGlow 2.2s var(--ease-slow) both;
}
@keyframes titleGlow{ 0%{filter:drop-shadow(0 0 0 rgba(122,243,255,0))} 100%{filter:drop-shadow(0 0 12px rgba(122,243,255,.25)) drop-shadow(0 0 16px rgba(200,140,255,.22))} }
.subtitle{ text-align:center; color:var(--muted); font-style:italic; margin:0 0 12px }

/* Dividers */
.divider{
  height:1px; margin:18px auto 24px; background:
  linear-gradient(90deg,transparent,rgba(122,243,255,.45),transparent),
  linear-gradient(90deg,transparent,var(--line),transparent);
  filter:drop-shadow(0 0 6px rgba(122,243,255,.18));
}
.goldline{
  height:1px; margin:28px auto; background:
  linear-gradient(90deg,transparent,rgba(243,201,122,.55),transparent),
  linear-gradient(90deg,transparent,rgba(122,243,255,.15),transparent);
}

/* ------------------------------ Tabs ------------------------------ */
.tabs{
  position:sticky; top:calc(56px + var(--safe-top)); z-index:55;
  display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin:8px 0 14px;
  overflow:auto; -webkit-overflow-scrolling:touch; scrollbar-gutter:stable both-edges; padding-bottom:6px;
  --ink-x:0px; --ink-w:8px;
}
.tabs .tab{
  display:inline-flex; align-items:center; padding:10px 14px; min-height:38px;
  border:1px solid var(--line); border-radius:10px; text-decoration:none; font:600 14px/1 Inter;
  background:rgba(255,255,255,.03); color:var(--ink);
  transition:transform .14s var(--ease), background-color .14s var(--ease), border-color .14s var(--ease);
}
.tab--primary{ border-color:#35404a; background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02)) }
.tabs .tab:hover,.tabs .tab:focus-visible{ transform:translateY(-1px); background:rgba(255,255,255,.05); border-color:#3a3a44 }
.tabs .tab-ink{
  position:absolute; left:var(--ink-x); width:var(--ink-w); height:2px; bottom:-4px;
  background:linear-gradient(90deg, var(--spec-cyan), var(--spec-gold), var(--spec-violet));
  border-radius:2px; box-shadow:0 0 12px rgba(122,243,255,.45); opacity:.95;
  transition:left .25s var(--ease), width .25s var(--ease), opacity .25s var(--ease);
}

/* ------------------------------ Grid ------------------------------ */
.grid{ display:grid; grid-template-columns:repeat(12,1fr); gap:16px }
.col-12{grid-column:span 12} .col-9{grid-column:span 9} .col-8{grid-column:span 8} .col-7{grid-column:span 7}
.col-6{grid-column:span 6} .col-5{grid-column:span 5} .col-4{grid-column:span 4} .col-3{grid-column:span 3}
@media (max-width:980px){ .col-9,.col-8,.col-7,.col-6,.col-5,.col-4,.col-3{ grid-column:span 12 } }
@media (max-width:360px){ .grid{ gap:12px } }

/* ------------------------------ Cards ------------------------------ */
.card{
  position:relative; background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005));
  border:1px solid var(--line); border-radius:var(--radius-md);
  padding:var(--pad-card) var(--pad-card) calc(var(--pad-card) - 2px);
  box-shadow:0 6px 14px rgba(0,0,0,.35); transform:translateZ(0);
  overflow:hidden; isolation:isolate;
}
.card::before,.card::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none }
.card::before{
  box-shadow:
    inset 0 0 0 1px rgba(122,243,255,.18),
    inset 0 0 22px rgba(122,243,255,.08),
    inset 0 0 36px rgba(122,168,255,.06);
  mix-blend-mode:screen;
}
.card::after{
  background:
    conic-gradient(from 0deg at 12px 12px, rgba(122,243,255,.45) 0 25%, transparent 0 100%),
    conic-gradient(from 90deg at calc(100% - 12px) 12px, rgba(122,168,255,.45) 0 25%, transparent 0 100%),
    conic-gradient(from 180deg at 12px calc(100% - 12px), rgba(156,255,221,.45) 0 25%, transparent 0 100%),
    conic-gradient(from 270deg at calc(100% - 12px) calc(100% - 12px), rgba(243,201,122,.35) 0 25%, transparent 0 100%);
  mask:
    radial-gradient(12px 12px at 12px 12px, #000 90%, transparent 100%),
    radial-gradient(12px 12px at calc(100% - 12px) 12px, #000 90%, transparent 100%),
    radial-gradient(12px 12px at 12px calc(100% - 12px), #000 90%, transparent 100%),
    radial-gradient(12px 12px at calc(100% - 12px) calc(100% - 12px), #000 90%, transparent 100%);
  mask-composite:exclude; opacity:.26;
}
@media (hover:hover){
  .card:hover{ box-shadow:0 12px 26px rgba(0,0,0,.4); }
}

/* Reveal */
.card{ opacity:0; transform:translateY(8px) scale(.995) }
.card.visible{ opacity:1; transform:none; transition:opacity var(--dur-2) var(--ease), transform var(--dur-2) var(--ease) }
html:not(.js-ready) .card{ opacity:1 !important; transform:none !important } /* safety if IO fails */

/* ------------------------------ Typography ------------------------------ */
h1,h2,h3{ color:#fff; margin:8px 0 10px; line-height:1.22; text-shadow:0 0 10px rgba(122,243,255,.08) }
h2{ font-size:var(--fs-4) } h3{ font-size:var(--fs-3) }
p{ margin:8px 0 10px }
.meta{ color:var(--muted); font-size:var(--fs-0) }
.hint{ color:var(--muted); font-size:.95em }

/* Lists & CTAs */
.list{ margin:0; padding-left:18px } .list li{ margin:6px 0 }
.cta{
  display:inline-block; margin-top:10px; padding:10px 12px; border-radius:var(--radius-sm); border:1px solid var(--line);
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005)); text-decoration:none; position:relative; overflow:hidden;
  transition:border-color var(--dur-1) var(--ease), transform var(--dur-1) var(--ease), box-shadow var(--dur-1) var(--ease);
}
.cta::after{
  content:""; position:absolute; inset:-1px; border-radius:inherit; pointer-events:none;
  box-shadow:inset 0 0 0 1px rgba(122,243,255,.25), inset 0 0 16px rgba(122,243,255,.08); opacity:.75;
}
@media (hover:hover){ .cta:hover{ border-color:#3a3a44; transform:translateY(-1px); box-shadow:0 0 18px rgba(122,243,255,.2) } }

/* Tiles */
.tile{
  display:block; text-decoration:none; border:1px solid var(--line); border-radius:var(--radius-md);
  padding:14px; background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.005));
  transition:transform .18s var(--ease), box-shadow .18s var(--ease), border-color .18s var(--ease);
  position:relative; isolation:isolate;
}
.tile::after{
  content:""; position:absolute; inset:-1px; border-radius:inherit; pointer-events:none;
  box-shadow:inset 0 0 0 1px rgba(122,243,255,.18), inset 0 0 18px rgba(122,243,255,.06); opacity:.75; transition:opacity .18s var(--ease)
}
@media (hover:hover){ .tile:hover{ transform:translateY(-2px); border-color:#3a3a44; box-shadow:0 10px 22px rgba(0,0,0,.35) } .tile:hover::after{ opacity:1 } }

/* ------------------------------ Tables ------------------------------ */
table{
  width:100%; border-collapse:collapse; border:1px solid var(--line); border-radius:12px; overflow:hidden; font-size:var(--fs-0);
  box-shadow:0 0 0 1px rgba(122,243,255,.12) inset;
}
thead th{
  background:linear-gradient(180deg,#16161d,#12121a);
  border-bottom:1px solid var(--line); padding:10px 12px; text-align:left; font-weight:600; color:#f2f1ec;
  text-shadow:0 0 8px rgba(122,243,255,.12);
}
tbody td{ border-top:1px solid var(--line); padding:10px 12px; vertical-align:top; color:var(--ink) }
tbody tr:nth-child(even) td{ background:rgba(255,255,255,.015) }
@media (max-width:560px){
  table{ display:block; overflow-x:auto; border-radius:12px }
  thead,tbody,tr,th,td{ white-space:nowrap }
}

/* ------------------------------ Equations (MathJax) ------------------------------ */
.eq{
  position:relative; overflow:hidden; border-radius:12px; background:#111115; border:1px solid #26262c;
  box-shadow:inset 0 0 20px rgba(255,200,107,.03), var(--glow-cyan), var(--glow-blue);
  margin:8px 0 10px;
}
.eq .eq-scroll{
  overflow-x:auto; max-width:100%; padding:12px 16px; -webkit-overflow-scrolling:touch;
  background:
    repeating-linear-gradient(90deg, rgba(122,243,255,.05) 0 1px, transparent 1px 24px),
    linear-gradient(180deg, rgba(200,140,255,.05), transparent);
  scroll-snap-type:x proximity;
  mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 28px, #000 calc(100% - 28px), transparent 100%);
  scrollbar-gutter: stable both-edges; cursor: grab;
}
.eq .eq-scroll:active{ cursor:grabbing }
.eq mjx-container{ display:block!important; filter:drop-shadow(0 0 10px rgba(255,200,107,.08)); scroll-snap-align:start; padding-right:24px }
.eq.eq-shimmer .eq-scroll::after{
  content:""; position:absolute; inset:0 0 0 -60%; width:60%;
  background:linear-gradient(110deg, transparent 0%, rgba(255,255,255,.07) 45%, rgba(255,255,255,.12) 50%, rgba(255,255,255,.07) 55%, transparent 100%);
  filter:blur(1px); opacity:0; pointer-events:none;
}
@media (prefers-reduced-motion:no-preference){
  @keyframes shimmerSlide{ 0%{transform:translateX(-110%); opacity:0} 10%{opacity:.7} 60%{opacity:.7} 100%{transform:translateX(210%); opacity:0} }
  .eq.eq-shimmer .eq-scroll::after{ animation:shimmerSlide 6.5s ease-in-out infinite }
  @keyframes eqPulse{ 0%{box-shadow:inset 0 0 20px rgba(255,200,107,.04), 0 0 0 0 rgba(122,243,255,.0)}
                      50%{box-shadow:inset 0 0 26px rgba(255,200,107,.06), 0 0 22px 0 rgba(122,243,255,.18)}
                      100%{box-shadow:inset 0 0 20px rgba(255,200,107,.04), 0 0 0 0 rgba(122,243,255,.0)} }
  .eq.eq-pulse{ animation:eqPulse 9s ease-in-out infinite }
}

/* Pop-out */
.eq--expanded{
  position:fixed; inset:4svh 4svw; z-index:10000; border-radius:16px; background:#0b0b10; border:1px solid #2a2a33;
  box-shadow:0 40px 120px rgba(0,0,0,.6); display:flex; flex-direction:column;
}
.eq--expanded .eq-scroll{ flex:1; padding:18px 22px; max-height:unset; overflow:auto; mask:none; -webkit-mask-image:none }
.eq--expanded .eq-close{
  position:absolute; right:12px; top:10px; appearance:none; border:1px solid #2a2a33; background:rgba(255,255,255,.03); color:var(--ink);
  padding:6px 10px; border-radius:10px; font:600 13px/1 Inter; cursor:pointer;
}
@media (max-width:720px){ .eq--expanded{ inset:0; border-radius:0 } }

/* Long inline math safety */
p mjx-container[display="inline"], li mjx-container[display="inline"], h3 mjx-container[display="inline"]{
  display:block!important; max-width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; padding-bottom:2px;
}

/* ------------------------------ Hero (Living Plasma + Parallax) ------------------------------ */
.hero{
  position:relative; margin:0 auto 10px; max-width:var(--maxw);
  border-radius:var(--radius-xl); overflow:hidden; background:var(--bg-elev);
  box-shadow:0 12px 36px rgba(0,0,0,.45), inset 0 0 40px rgba(255,200,107,.05), inset 0 0 0 1px rgba(122,243,255,.12);
  isolation:isolate; perspective:1200px;
}
.hero img{
  display:block; width:100%; height:auto; aspect-ratio:var(--hero-aspect);
  object-fit:cover; object-position:var(--hero-focal-mobile);
  background:var(--bg-elev); max-height:min(68vh,880px); will-change:transform,opacity; transform:translateZ(0);
}
@media (min-width:860px){ .hero img{ object-position:var(--hero-focal-desktop) } }
.hero[data-fit="contain"] img,.hero.hero--contain img{ object-fit:contain!important; object-position:center center!important; max-height:min(78vh,920px) }
.hero[data-fit="cover"] img,.hero.hero--cover img{ object-fit:cover!important }

/* Plasma field layer (CSS-only synthesis) */
.hero--plasma::before,
.hero--plasma::after{
  content:""; position:absolute; inset:-15% -15% -10% -15%; pointer-events:none; z-index:0;
}
.hero--plasma::before{
  background:
    radial-gradient(40% 60% at 30% 45%, rgba(122,243,255,.25), transparent 60%),
    radial-gradient(30% 40% at 70% 55%, rgba(243,201,122,.22), transparent 60%),
    radial-gradient(22% 30% at 48% 40%, rgba(200,140,255,.22), transparent 70%),
    conic-gradient(from 220deg at 50% 50%, rgba(122,243,255,.12), transparent 40%, rgba(243,201,122,.12), transparent 80%);
  mix-blend-mode:screen; filter:blur(16px); opacity:.75;
}
.hero--plasma::after{
  background:
    radial-gradient(120px 140px at 48% 46%, rgba(255,255,255,.45), transparent 60%),
    radial-gradient(280px 220px at 52% 58%, rgba(122,243,255,.18), transparent 70%),
    radial-gradient(220px 240px at 35% 38%, rgba(200,140,255,.18), transparent 70%);
  mix-blend-mode:screen; filter:blur(10px) saturate(120%); opacity:.55;
}

/* Interactive parallax: JS updates --parallax-x/y/zoom */
.hero[data-parallax="1"] .hero-layer{
  transform:perspective(1200px) rotateX(var(--parallax-y)) rotateY(var(--parallax-x)) scale(var(--parallax-zoom));
  transform-style:preserve-3d; transition:transform .08s linear;
}
.hero .hero-layer{ position:absolute; inset:0; }

/* Caption */
.hero-caption{
  position:absolute; inset:auto 0 6% 0; display:grid; place-items:center; pointer-events:none; z-index:2; padding:0 16px;
}
.hero-caption .cap-inner{
  max-width:min(92vw, 980px); border-radius:14px;
  background:linear-gradient(180deg, rgba(12,12,16,.54), rgba(12,12,16,.26));
  border:1px solid rgba(36,36,44,.85);
  box-shadow:0 20px 60px rgba(0,0,0,.45), inset 0 0 0 1px rgba(122,243,255,.10);
  backdrop-filter:blur(8px) saturate(140%);
  padding:14px 18px; text-align:center;
}
.hero-caption .cap-eyebrow{
  font:700 12px/1.2 Inter; letter-spacing:.18em; text-transform:uppercase; color:rgba(122,243,255,.9); margin-bottom:6px;
}
.hero-caption h2{
  margin:0 0 2px; font:800 clamp(22px,4.8vw,36px)/1.1 "Crimson Pro", Georgia, serif;
  background:linear-gradient(90deg, var(--spec-cyan), var(--spec-gold), var(--spec-violet)); -webkit-background-clip:text; color:transparent;
  text-shadow:0 0 18px rgba(122,243,255,.15), 0 0 20px rgba(200,140,255,.12);
}
.hero-caption p{ margin:0; color:var(--muted); font-style:italic }

/* Pulse overlay (optional) */
.hero .hero-pulse{
  position:absolute; inset:0; pointer-events:none; z-index:1; opacity:var(--pulse-opacity); mix-blend-mode:screen; display:none;
  background:
    radial-gradient(circle at 50% 55%, var(--pulse-c1) 0 8%, transparent 40%),
    radial-gradient(circle at 50% 55%, var(--pulse-c2) 0 5%, transparent 28%);
}
.hero.pulse .hero-pulse{ display:block }

/* Scanline drift (calmer) */
@keyframes scanFloat{ to{ background-position-y:10px } }
.hero.star-scan::after{
  content:""; position:absolute; inset:0; pointer-events:none; z-index:1; opacity:.12;
  background:repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0 1px, transparent 1px 3px);
  animation:scanFloat 8s linear infinite; animation-play-state:paused;
}
.hero.is-active.star-scan::after{ animation-play-state:running }

/* Compact mobile */
@media (max-width:480px){
  .hero{ margin-top:6px }
  .hero img{ object-fit:contain; max-height:56vh }
  .hero-caption .cap-inner{ padding:12px 14px }
}

/* Clean hero option (no overlays) */
.hero--clean .hero-caption,.hero--clean .hero-pulse{ display:none !important }
.hero--clean::before,.hero--clean::after{ display:none !important }

/* ------------------------------ HUD / Laser Grid ------------------------------ */
.laser-grid{
  position:fixed; inset:-10% -10% 0 -10%; pointer-events:none; z-index:0; mix-blend-mode:screen; opacity:.44;
  background:
    radial-gradient(1200px 600px at 65% -5%, rgba(122,243,255,.08), transparent 60%),
    repeating-linear-gradient(90deg, rgba(122,243,255,.08) 0 1px, transparent 1px 26px),
    repeating-linear-gradient(0deg, rgba(243,201,122,.06) 0 1px, transparent 1px 26px);
}
@media (prefers-reduced-motion:no-preference){
  @keyframes gridDriftA{ 0%{transform:translateY(0)} 50%{transform:translateY(8px)} 100%{transform:translateY(0)} }
  @keyframes gridDriftB{ 0%{background-position:0 0, 0 0, 0 0} 100%{background-position:0 0, 60px 0, 0 60px} }
  .laser-grid{ animation:gridDriftA 16s ease-in-out infinite, gridDriftB 22s linear infinite }
}

/* ------------------------------ Particle Network ------------------------------ */
.particle-net{
  position:fixed; inset:0; z-index:1; pointer-events:none; mix-blend-mode:screen; opacity:.35;
  background-image:
    radial-gradient(2px 2px at 20% 30%, var(--spec-cyan), transparent 40%),
    radial-gradient(2px 2px at 35% 60%, var(--spec-gold), transparent 40%),
    radial-gradient(2px 2px at 65% 25%, var(--spec-violet), transparent 40%),
    radial-gradient(1.8px 1.8px at 80% 70%, var(--spec-green), transparent 40%),
    radial-gradient(1.6px 1.6px at 12% 75%, var(--spec-blue), transparent 40%);
  filter:drop-shadow(0 0 6px rgba(122,243,255,.25));
}
.particle-net::after{
  content:""; position:absolute; inset:0; background:
    linear-gradient(90deg, transparent 0%, rgba(122,243,255,.08) 50%, transparent 100%),
    linear-gradient(0deg, transparent 0%, rgba(200,140,255,.08) 50%, transparent 100%);
  background-size:480px 1px, 1px 380px; background-repeat:repeat; opacity:.25;
}
@media (prefers-reduced-motion:no-preference){
  @keyframes twinkle{ 0%,100%{opacity:.22} 50%{opacity:.45} }
  @keyframes linkDrift{ to{ background-position:480px 0, 0 380px } }
  .particle-net{ animation:twinkle 9s ease-in-out infinite }
  .particle-net::after{ animation:linkDrift 24s linear infinite }
}

/* ------------------------------ Simple Mode ------------------------------ */
.simple-toggle{ display:flex; align-items:center; gap:10px; justify-content:center; margin:0 0 14px }
.simple-toggle input{ accent-color:#8be9ff; transform:scale(1.1) }
.eq-note{ display:none; color:var(--muted); font-style:italic; margin:8px 2px 0 }
.simple-on .eq{ display:none } .simple-on .eq-note{ display:block }

/* ------------------------------ Back to Top ------------------------------ */
.to-top{
  position:fixed; right:14px; bottom:calc(16px + var(--safe-bottom)); z-index:20;
  border-radius:12px; border:1px solid #2a2a33; background:rgba(12,12,16,.55); backdrop-filter:blur(6px);
  padding:10px 12px; font:600 13px/1 Inter; color:var(--ink); cursor:pointer; display:none;
}
.to-top.show{ display:block } .to-top:hover{ border-color:#3a3a44 }

/* ------------------------------ Command Palette ------------------------------ */
.palette{ position:fixed; inset:0; z-index:80; display:none; background:rgba(10,10,14,.6); backdrop-filter:blur(8px) }
.palette.open{ display:block }
.palette .panel{
  max-width:760px; margin:12vh auto; background:#101017; border:1px solid #2a2a33; border-radius:14px; overflow:hidden;
  box-shadow:0 20px 60px rgba(0,0,0,.45);
}
.palette input{
  width:100%; padding:14px 16px; background:#0c0c12; color:var(--ink); border:0; border-bottom:1px solid #23232c; font:500 16px/1.4 Inter;
}
.palette ul{ list-style:none; margin:0; padding:10px }
.palette li{ padding:8px 10px; border-radius:10px; cursor:pointer }
.palette li:hover{ background:#15151e }
.palette li.sel{ background:#161621; outline:2px solid rgba(122,243,255,.35); box-shadow:0 0 0 4px rgba(122,243,255,.12) }

/* ------------------------------ Footer ------------------------------ */
footer.footer{ text-align:center; color:var(--muted); margin-top:20px; font-size:var(--fs-0) }

/* ------------------------------ Site Search Suggest ------------------------------ */
#site-suggest{
  position:absolute; top:100%; left:0; right:0; margin-top:8px; z-index:90;
  border:1px solid var(--line); border-radius:12px; background:#0f0f14;
  box-shadow:0 20px 50px rgba(0,0,0,.45), inset 0 0 0 1px rgba(122,243,255,.12);
  padding:10px;
}
#site-suggest a{
  display:block; padding:8px 10px; border-radius:10px; text-decoration:none; border:1px solid transparent;
}
#site-suggest a:hover,#site-suggest a:focus-visible{ border-color:#3a3a44; background:rgba(255,255,255,.04) }

/* ------------------------------ A11y & Misc ------------------------------ */
p,li,td,th{ overflow-wrap:anywhere }
:target{ scroll-margin-top: clamp(72px, 11vh, 120px) }

/* ------------------------------ Print ------------------------------ */
@media print{
  :root{ --bg:#fff; --ink:#000; --muted:#333; --line:#ccc }
  *{ box-shadow:none!important; text-shadow:none!important; background-image:none!important; animation:none!important }
  body{ background:#fff!important; color:#000!important }
  .wrap{ max-width:100%; padding:0 12mm }
  .hero,.particle-net,.laser-grid,.hero-caption,.mini-toc,header.site,.to-top{ display:none!important }
  .card{ border:1px solid #ccc; page-break-inside:avoid }
  a{ color:#000; text-decoration:underline }
  .cta{ border:1px solid #aaa }
  .goldline,.divider{ background:#ccc!important }
  .eq{ background:#fff; border:1px solid #ccc; box-shadow:none!important }
  mjx-container{ filter:none!important }
  table{ border:1px solid #ccc } thead th{ background:#f4f4f4; color:#000; text-shadow:none }
}

/* ------------------------------ Scrollbar (nice-to-have) ------------------------------ */
@supports selector(:root:has(body)){
  body::-webkit-scrollbar{ width:12px }
  body::-webkit-scrollbar-track{ background:#0f0f14 }
  body::-webkit-scrollbar-thumb{
    background:#2b2b35; border-radius:10px; border:2px solid #0f0f14; box-shadow: inset 0 0 12px rgba(122,243,255,.15);
  }
}

/* ------------------------------ Performance Modes ------------------------------ */
@supports (content-visibility:auto){
  main>.grid,section,article,.card{ content-visibility:auto; contain-intrinsic-size:600px }
  .card{ contain-intrinsic-size:360px }
}
body.performance-warming .hero::before,
body.performance-warming .hero::after,
body.performance-warming .card::after,
body.performance-warming .card::before{ opacity:0!important }
body.performance-warming .card{ box-shadow:none!important }
@keyframes warmOff{ to{ opacity:1 } }
body.performance-warming{ animation:warmOff .9s linear forwards }

/* Reduced motion & data */
@media (prefers-reduced-motion:reduce){
  *{ animation:none!important; transition:none!important; scroll-behavior:auto!important }
  .card{ opacity:1!important; transform:none!important }
  .hero.star-scan::after,.hero .hero-pulse,.laser-grid,.particle-net{ display:none!important }
}
@media (prefers-reduced-data:reduce){
  body{ background-image:none!important }
  .laser-grid,.particle-net,.hero--plasma::before,.hero--plasma::after{ display:none!important }
  .card::before,.card::after{ display:none!important }
  .eq{ box-shadow:inset 0 0 12px rgba(255,200,107,.03) }
}

/* ------------------------------ Ambient Hum Hooks (visual only) ------------------------------ */
.hum-indicator{
  position:fixed; left:14px; bottom:calc(16px + var(--safe-bottom)); z-index:20;
  display:none; align-items:center; gap:8px; padding:8px 10px; border-radius:12px;
  background:rgba(12,12,16,.55); border:1px solid #2a2a33; backdrop-filter:blur(6px);
  color:var(--muted); font:600 12px/1 Inter;
}
.hum-indicator::before{
  content:""; width:10px; height:10px; border-radius:50%;
  background:radial-gradient(circle at 40% 40%, var(--spec-uv), transparent 60%);
  box-shadow:0 0 8px var(--spec-uv);
}
.hum-on .hum-indicator{ display:flex }
