/* === Scroll of Fire — Codex.js (Living Tech) ===============================
 * - Reveal on scroll (IO + rAF fallback)
 * - Current year swap
 * - External links hardening
 * - Robust banner failover (Meta webviews)
 * - MathJax gentle re-typeset
 * - Live cosmetics: parallax hero, scroll-linked glow, card tilt
 * - Equation helpers: auto-number + copy-LaTeX buttons
 * No HTML edits required.
 */

(function () {
  "use strict";

  /* ---------- utils ---------- */
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const inVP = (el, threshold=0.88) => {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * threshold;
  };

  /* ---------- reveal on scroll ---------- */
  const useIO = "IntersectionObserver" in window &&
    matchMedia("(prefers-reduced-motion: no-preference)").matches;

  function initReveal(){
    const targets = $$(".card, .divider");
    if (useIO){
      const io = new IntersectionObserver((ents)=>{
        for (const e of ents){
          if (e.isIntersecting){ e.target.classList.add("visible"); io.unobserve(e.target); }
        }
      }, { root: null, rootMargin: "0px 0px -12%" });
      targets.forEach(el => io.observe(el));
    } else {
      const tick = () => targets.forEach(el => inVP(el) && el.classList.add("visible"));
      let ticking = false;
      const onScroll = () => { if (!ticking){ ticking = true; requestAnimationFrame(()=>{ tick(); ticking = false; }); } };
      window.addEventListener("scroll", onScroll, { passive:true });
      window.addEventListener("load", tick, { once:true });
      tick();
    }
  }

  /* ---------- current year ---------- */
  function swapYear(){
    const y = $("#yr"); if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------- harden external links ---------- */
  function hardenExternal(){
    $$('a[target="_blank"]').forEach(a=>{
      const rel = (a.getAttribute("rel")||"").toLowerCase();
      if (!rel.includes("noopener")) a.setAttribute("rel", (rel ? rel+" " : "") + "noopener");
    });
  }

  /* ---------- banner failover (Meta webviews / slow decode) ---------- */
  function bannerFailover(){
    const img = $("#heroBanner"); if (!img) return;
    const ua  = navigator.userAgent || "";
    const isMeta = /FBAN|FBAV|Facebook|Instagram|FB_IAB|FBAN\/Messenger/i.test(ua);
    const local  = img.getAttribute("data-src-local");

    const swapToLocal = ()=>{ if (local && !img.src.includes(local)) img.src = local; };

    if (isMeta) swapToLocal();
    img.addEventListener("error", swapToLocal, { once:true });
    const t = setTimeout(()=>{ if (!img.complete || img.naturalWidth === 0) swapToLocal(); }, 2500);
    img.addEventListener("load", ()=>clearTimeout(t), { once:true });
  }

  /* ---------- MathJax gentle re-typeset ---------- */
  function mathjaxNudge(){
    if (!window.MathJax) return;
    const run = () => { try { window.MathJax.typeset && window.MathJax.typeset(); } catch(_){} };
    window.addEventListener("load", () => setTimeout(run, 200));
  }

  /* ---------- live cosmetics: parallax + glow + tilt ---------- */
  function initLiveCosmetics(){
    const hero = $(".hero img");
    const sigLine = $(".sigil-line");
    if (hero){
      const parallax = () => {
        const y = window.scrollY || window.pageYOffset || 0;
        const damp = Math.max(0, Math.min(1, 1 - y/900));
        hero.style.transform = `translateY(${y * -0.08}px) scale(${1 + y*0.00006})`;
        if (sigLine) sigLine.style.setProperty("--sigGlowShift", `${(y*0.25)%200}%`);
      };
      window.addEventListener("scroll", parallax, { passive:true });
      parallax();
    }

    // subtle card tilt on pointer
    if (matchMedia("(hover:hover)").matches){
      const cards = $$(".card");
      cards.forEach(card=>{
        card.addEventListener("mousemove", (e)=>{
          const r = card.getBoundingClientRect();
          const cx = r.left + r.width/2, cy = r.top + r.height/2;
          const dx = (e.clientX - cx)/r.width;
          const dy = (e.clientY - cy)/r.height;
          card.style.setProperty("--tiltY", `${dx*4}deg`);
          card.style.setProperty("--tiltX", `${-dy*4}deg`);
        });
        card.addEventListener("mouseleave", ()=>{
          card.style.setProperty("--tiltY", "0deg");
          card.style.setProperty("--tiltX", "0deg");
        });
      });
    }
  }

  /* ---------- equations: auto-number + copy buttons ---------- */
  function enhanceEquations(){
    const blocks = $$(".eq");
    let n = 0;
    blocks.forEach((b)=>{
      n += 1;
      b.setAttribute("data-eqno", `[Eq. ${n}]`);
      // add copy button (copies LaTeX inside block)
      const btn = document.createElement("button");
      btn.className = "eq-copy";
      btn.type = "button";
      btn.textContent = "Copy";
      btn.addEventListener("click", ()=>{
        // Try to find MathJax source; fallback to text content
        let latex = "";
        // If MathJax v3 generated <mjx-container>, we grab the <script> tex source if present
        const src = b.querySelector('script[type="math/tex"], script[type="math/tex; mode=display"]');
        if (src) latex = src.textContent.trim();
        if (!latex){
          // fallback: extract from original math text if $$...$$ present
          const raw = b.textContent || "";
          const m = raw.match(/\$\$([\s\S]*?)\$\$/);
          latex = m ? m[1].trim() : raw.trim();
        }
        navigator.clipboard.writeText(latex).then(()=>{
          btn.textContent = "Copied!";
          setTimeout(()=>btn.textContent="Copy", 1200);
        }).catch(()=>{ btn.textContent = "Error"; setTimeout(()=>btn.textContent="Copy", 1200); });
      });
      b.appendChild(btn);
    });
  }

  /* ---------- init ---------- */
  document.addEventListener("DOMContentLoaded", ()=>{
    initReveal();
    swapYear();
    hardenExternal();
    bannerFailover();
    mathjaxNudge();
    initLiveCosmetics();
    enhanceEquations();
  });
})();
