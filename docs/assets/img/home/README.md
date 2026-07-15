Home

Purpose

This folder contains images created specifically for the main Codex of Reality homepage.

Public Path

/assets/img/home/

Main Asset Types

- Homepage identity artwork
- Gateway artwork
- Section illustrations
- Backgrounds
- Animation posters
- Social media exports

Subfolders

hero/
gates/
sections/
backgrounds/
posters/
social/

Planned Root Assets

home-codex-living-system.webp
home-breath-field-poster.webp
home-living-framework-equation.webp
home-daily-return.webp
home-core-gates.webp

Whenever possible, place new files in the appropriate subfolder rather than leaving them in the root "home" folder.

Rules

- Use this folder only for homepage-specific artwork.
- Move reusable assets into "/assets/img/shared/".
- Keep normal website imagery free of baked-in text.
- Use one clear visual purpose for each image.
- Maintain the dark navy, gold, copper, and cyan visual language.
- Preserve open space for responsive headings and buttons.
- Avoid image collages unless the image is specifically designed for social promotion.

Naming Standard

home-purpose-variant.webp

Examples:

home-codex-living-system.webp
home-daily-return.webp
home-core-gates.webp

Completion Checklist

- [ ] Concept approved
- [ ] Image created
- [ ] Desktop crop prepared
- [ ] Mobile crop prepared
- [ ] Converted to WebP
- [ ] Compressed
- [ ] Added to HTML or CSS
- [ ] Alternative text added
- [ ] Verified on mobile
- [ ] Verified on desktop

Home / Hero

Purpose

This folder contains the primary homepage hero artwork and its responsive variants.

The hero should introduce the Codex of Reality as one connected living system.

Public Path

/assets/img/home/hero/

Planned Assets

home-codex-living-system.webp
home-codex-living-system-mobile.webp
home-codex-living-system-poster.webp

Hero Concept

The main hero may contain:

- A central Codex seal
- Thirteen moon markers
- Copper circuitry or wrapped copper paths
- Celestial geometry
- A road or caravan path
- Water, stone, fire, air, and stars
- A handcrafted artifact
- Golden and cyan energy linking the complete system

The hero should look like one unified environment rather than a collage.

Composition Rules

- Keep the central subject protected from cropping.
- Preserve dark space for the homepage heading.
- Avoid placing important details along the left, right, top, or bottom edges.
- Make sure the central composition survives mobile cropping.
- Do not bake the homepage title or buttons into the image.
- Keep edge contrast lower than center contrast.
- Avoid overly bright details behind navigation elements.

Suggested Sizes

Desktop:

1920 × 1200

Mobile:

1080 × 1350

Poster fallback:

1600 × 1000

Loading Rules

The main hero is normally the only homepage image that should use:

loading="eager"
fetchpriority="high"

All other homepage images should normally load lazily.

Example

<picture>
  <source
    media="(max-width: 720px)"
    srcset="/assets/img/home/hero/home-codex-living-system-mobile.webp"
  >

  <img
    src="/assets/img/home/hero/home-codex-living-system.webp"
    alt="The Codex of Reality shown as an interconnected living system."
    width="1920"
    height="1200"
    loading="eager"
    fetchpriority="high"
  >
</picture>

Completion Checklist

- [ ] Main hero concept approved
- [ ] Desktop artwork completed
- [ ] Mobile crop completed
- [ ] Heading remains readable
- [ ] Buttons remain readable
- [ ] Main subject survives mobile crop
- [ ] Converted to WebP
- [ ] Compressed
- [ ] Tested with navigation open
- [ ] Tested on desktop
- [ ] Tested on mobile

Home / Gates

Purpose

This folder contains the major visual entrances into the primary systems of the Codex of Reality.

Each image should represent one destination.

Public Path

/assets/img/home/gates/

Planned Assets

home-gate-13-moons.webp
home-gate-covenant-caravan.webp
home-gate-frequency-governance.webp
home-gate-witness-ledger.webp
home-gate-artifact-registry.webp
home-gate-genesis-oracle.webp
home-gate-theory-canon.webp

Gateway Definitions

Remnant 13 Moons

home-gate-13-moons.webp

Visual direction:

- Thirteen celestial medallions
- Moon phases
- Calendar geometry
- Active day marker
- Gold and cyan pathways

Covenant Caravan

home-gate-covenant-caravan.webp

Visual direction:

- Modern artisan caravan
- Horse-drawn travel
- Road, plains, forest, or mountains
- Craft tools and handmade objects
- Five stages: Stabilize, Practice, Build, Trade, Move

Frequency Governance

home-gate-frequency-governance.webp

Visual direction:

- Resonant field
- Concentric rings
- Chladni geometry
- Waveforms
- Torus, lattice, orbit, and signal patterns

Witness Ledger

home-gate-witness-ledger.webp

Visual direction:

- Open living ledger
- Moon and day markers
- Written observations
- A glowing present-day entry
- Memory and pattern fields

Artifact Registry

home-gate-artifact-registry.webp

Visual direction:

- Copper, stone, sea glass, wire, and tools
- Finished and unfinished pieces
- Registry markings
- Dark artisan workbench or archive chamber

Genesis Oracle

home-gate-genesis-oracle.webp

Visual direction:

- Opening scroll
- Symbolic language
- A luminous question field
- Ancient structure mixed with living circuitry

Theory and Canon

home-gate-theory-canon.webp

Visual direction:

- Illuminated system map
- Equations
- Scroll fragments
- Geometry
- Codex seals
- Connected theoretical structures

Rules

- One image equals one gateway.
- Never combine multiple gateways into one collage.
- Use square compositions unless the card design requires otherwise.
- Keep all gateway images visually related.
- Use one dominant subject per image.
- Keep text and labels in HTML.
- Make each gateway identifiable even without a title.
- Do not make every gateway equally bright; use light to establish hierarchy.

Suggested Size

1200 × 1200

Optional mobile crop:

1080 × 1350

HTML Example

<a class="gateway-card" href="/moons">
  <img
    src="/assets/img/home/gates/home-gate-13-moons.webp"
    alt="Enter the Remnant 13 Moons calendar."
    width="1200"
    height="1200"
    loading="lazy"
  >

  <div class="gateway-card__content">
    <h3>Remnant 13 Moons</h3>
    <p>Open the living calendar.</p>
  </div>
</a>

Completion Checklist

- [ ] Destination clearly represented
- [ ] One dominant visual idea
- [ ] No collage layout
- [ ] Matches the Codex visual system
- [ ] Square crop completed
- [ ] Mobile crop tested
- [ ] Converted to WebP
- [ ] Compressed
- [ ] Added to destination card
- [ ] Alternative text added
- [ ] Link tested

Home / Sections

Purpose

This folder contains images that explain major homepage sections, processes, practices, and systems.

These images support understanding rather than acting primarily as navigation thumbnails.

Public Path

/assets/img/home/sections/

Planned Assets

home-section-what-this-is.webp
home-section-daily-return.webp
home-section-living-framework.webp
home-section-manifest-practice.webp
home-section-caravan-path.webp

Section Definitions

What This Is

home-section-what-this-is.webp

Should visually connect:

- Calendar
- Frequency
- Artifacts
- Witness
- Caravan
- Theory

Daily Return

home-section-daily-return.webp

Should represent:

Observe → Name → Breathe → Record → Return

Living Framework

home-section-living-framework.webp

Should represent:

Reality =
(Energy × Information × Intention × Memory × Flow)
^ Consciousness

Manifest Practice

home-section-manifest-practice.webp

Should represent:

Gather → Name → Release → Return

Caravan Path

home-section-caravan-path.webp

Should represent:

Stabilize → Practice → Build → Trade → Move

Rules

- Use wide landscape compositions where possible.
- Keep these images calmer than the homepage hero.
- Images should clarify a process or relationship.
- Avoid crowded diagrams with unreadable text.
- Use HTML text for labels when practical.
- Use continuous visual movement rather than separate boxed panels.
- Make sure the image still works when partially cropped.

Suggested Size

1600 × 900

Alternative tall format:

1200 × 1500

Completion Checklist

- [ ] Process is visually understandable
- [ ] Composition supports accompanying text
- [ ] No essential information exists only inside the image
- [ ] Desktop crop completed
- [ ] Mobile crop tested
- [ ] Converted to WebP
- [ ] Compressed
- [ ] Added to the correct section
- [ ] Alternative text added
- [ ] Verified on dark background

Home / Backgrounds

Purpose

This folder contains ambient homepage textures, visual fields, and section backgrounds.

These assets support the page without competing with the main content.

Public Path

/assets/img/home/backgrounds/

Planned Assets

home-bg-celestial-grid.webp
home-bg-copper-circuit.webp
home-bg-witness-field.webp
home-bg-deep-navy-noise.webp

Background Definitions

Celestial Grid

home-bg-celestial-grid.webp

Use for:

- Calendar sections
- Theory sections
- Core gateway areas
- Celestial transitions

Copper Circuit

home-bg-copper-circuit.webp

Use for:

- Artifact sections
- Living Technology
- T-7 or conduit references
- System architecture sections

Witness Field

home-bg-witness-field.webp

Use for:

- Ledger sections
- Daily practice
- Memory and observation areas
- Return exercises

Deep Navy Noise

home-bg-deep-navy-noise.webp

Use as a nearly invisible base texture across dark sections.

Rules

- Keep contrast low.
- Keep file size small.
- Do not place important symbols near the edges.
- Avoid visible seams.
- Make backgrounds tile cleanly when possible.
- Avoid strong focal points behind text.
- Test heading and paragraph readability.
- Use gradients over backgrounds when necessary.

CSS Example

.home-section {
  background-image:
    linear-gradient(
      rgba(5, 7, 13, 0.82),
      rgba(5, 7, 13, 0.96)
    ),
    url("/assets/img/home/backgrounds/home-bg-deep-navy-noise.webp");
}

Accessibility

Decorative CSS backgrounds do not require alternative text.

Important information should never exist only inside a CSS background image.

Completion Checklist

- [ ] Low contrast
- [ ] Text remains readable
- [ ] No distracting focal point
- [ ] Seamless or crop-safe
- [ ] Converted to WebP
- [ ] Compressed
- [ ] Tested on long sections
- [ ] Tested on mobile
- [ ] Tested on desktop

Home / Posters

Purpose

This folder contains static fallback images for animated, interactive, canvas-based, or motion-driven homepage features.

Public Path

/assets/img/home/posters/

Planned Assets

home-poster-breath-field.webp
home-poster-frequency-field.webp
home-poster-living-network.webp

Uses

Poster images may appear:

- Before an animation loads
- When JavaScript is disabled
- When reduced-motion mode is active
- Behind a canvas visualizer
- As a fallback for unsupported browsers
- As a preview image for an interactive feature

Poster Definitions

Breath Field

home-poster-breath-field.webp

Should represent:

Gather → Name → Release → Return

Frequency Field

home-poster-frequency-field.webp

Should resemble the opening frame of the frequency visualizer.

Living Network

home-poster-living-network.webp

Should represent the interconnected homepage system before animation begins.

Rules

- Match the first frame or visual style of the interactive feature.
- Do not create a visually unrelated fallback.
- Keep the poster readable without motion.
- Avoid text baked into the image.
- Maintain the same crop as the canvas or video container.
- Test with reduced-motion preferences enabled.

HTML Example

<div
  class="breath-field"
  style="
    background-image:
      url('/assets/img/home/posters/home-poster-breath-field.webp');
  "
>
  <canvas id="breathCanvas" aria-hidden="true"></canvas>
</div>

Reduced-Motion Example

@media (prefers-reduced-motion: reduce) {
  .breath-field canvas {
    display: none;
  }

  .breath-field {
    background-image:
      url("/assets/img/home/posters/home-poster-breath-field.webp");
  }
}

Completion Checklist

- [ ] Matches interactive feature
- [ ] Correct aspect ratio
- [ ] Works without animation
- [ ] Reduced-motion state tested
- [ ] JavaScript-disabled state tested
- [ ] Converted to WebP
- [ ] Compressed
- [ ] No essential text baked in

Home / Social

Purpose

This folder contains social media and sharing graphics based on the homepage.

These files are not intended to load inside the normal webpage.

Public Path

/assets/img/home/social/

Planned Assets

home-social-og.webp
home-social-facebook.webp
home-social-square.webp
home-social-story.webp

Formats

Open Graph

home-social-og.webp
1200 × 630

Use for:

- Facebook link previews
- Messenger previews
- LinkedIn
- General Open Graph sharing

Facebook

home-social-facebook.webp
1200 × 1500

Use for a taller Facebook image post.

Square

home-social-square.webp
1080 × 1080

Use for:

- Facebook
- Instagram
- General square promotional posts

Story

home-social-story.webp
1080 × 1920

Use for:

- Facebook Stories
- Instagram Stories
- Vertical promotion

Rules

- Social-specific exports may include text.
- Keep important text within safe margins.
- Use the main homepage identity artwork as the visual foundation.
- Do not use the story image as a normal website image.
- Keep the project name readable at thumbnail size.
- Avoid excessive paragraphs inside the artwork.
- Use one headline and one supporting line at most.

Open Graph Example

<meta
  property="og:image"
  content="https://codexofreality.org/assets/img/home/social/home-social-og.webp"
>

<meta
  property="og:image:width"
  content="1200"
>

<meta
  property="og:image:height"
  content="630"
>

Suggested Text

Main title:

Codex of Reality

Supporting line:

13 Moons · Living Technology · Witness · Caravan · Frequency

Completion Checklist

- [ ] Open Graph image created
- [ ] Facebook crop created
- [ ] Square crop created
- [ ] Story crop created
- [ ] Text remains readable
- [ ] Safe margins verified
- [ ] Mobile preview checked
- [ ] File size compressed
- [ ] Open Graph metadata updated
- [ ] Facebook sharing preview tested
