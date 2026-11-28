# Unified Spark Goods — one item, one id, everywhere

*As-built design record, Nov 27, 2026. Aaron's directions, main chat Nov 27,
16:26–16:27 PST: "Things bought over the site for the spark should be able to
be carried from the platform to the app, to the game. Etc. So unify that all.
Make the items really worth it. And strategies how the items can be used." —
"Build onto the details heavily for purchased things. And make them useful
and add extras into the game visually etc."*

The machine-readable half of this law lives in the catalogue itself:
`docs/assets/data/spark-goods.json`, top-level `unified` section (law, the
three forms, the carrying path, the counts, the wardrobe mapping, the
no-game-form list). This note is the keeper-readable half. Where the two
disagree, the catalogue data governs and this note is corrected to it.

## The law

**One item, one id, everywhere.** A good is bought once — or earned once —
and is then the Spark's own on the site, in Spark. Living Day, and in
SPARK! Wake the World, under the same catalogue id in all three places.
The catalogue is the one price book and the one id book; no country keeps
a private list of goods.

### The three forms

- **Site form.** The good stands on the keeper's own Spark at the stall
  and in its rooms — worn on the flame, carried at its side, left behind
  it as a trail, wrapped around its flame, or the Spark itself: its
  brightenings, its manners, and its hums. The themes are the light the
  Spark stands in; the home goods stand on its ground beside it.
- **Living Day form.** The good rides in the Spark's carried record and
  stands in the Spark's ground in the app — worn, carried, sounded, or
  set in its home — so the Spark that opens the day is dressed by the
  same record the stall wrote.
- **Game form.** Presence only: worn on the hero in the menus and in
  flight, left behind it as a trail, sounded in its chirps and hums, or
  standing as the ground the road runs over.

### The carrying path, stated exactly

1. Bought on the site: the stall's order carries the buyer's Spark
   passport, and the good is written into the buying device's goods
   record (`sof.spark.goods.v1`) under its catalogue id —
   `obtained: purchased`, hash-chained like the Spark's own record.
2. The same id in the Spark's carried record is what Spark. Living Day
   reads: the good stands in the Spark's ground in the app because the
   record, not the shop, is what travels.
3. The game's carried record mirrors the same id space: wardrobe ids
   and goods ids are one space (the mapping below), so a piece the
   record carries is worn by the hero in the menus and in flight.
4. Earned goods travel the same road with `obtained: earned`. The
   record remembers the road each good came by — purchased or earned —
   and bought goods never imitate the earned mark.

## What "useful in the game" means — the strategy

Aaron asked whether purchased things can be useful in the game, and how.
The answer the standing law (Nov 25) allows, and the one this build
carries: **in the game, a good is how your Spark appears and sounds —
recognised at a glance, yours — and never how it performs.** Nothing
sold is power, progress, retries, or time. The physics are identical
under every outfit; the road is exactly as hard, and exactly as fair,
dressed or bare. A good that made a flight stronger would be a good
that made every unbought Spark weaker, and the catalogue's fences
forbid it in plain words.

Within that law, the game presence is real, and it is specific per good
— the `gamePresence` field of every good says exactly what it does
there:

- **Carried goods** ride at the hero's side — menus, road, the Arrival
  flight, and small and warm through every flight.
- **Worn goods** sit in the hat/worn family on the hero, in flight as
  in the menus; the Moon-Phase Band even keeps the real day's count on
  the road, today's moon lit.
- **Trails** are flight treatments — the $19 band's Long Ribbon and
  Return-Path Wrap change how the Spark's light *looks* in flight,
  which is what the Heirloom band is reserved for.
- **Wraps** close or lift the flame in the wrap slot.
- **Expressions** are the hero's face-work at the moments that matter —
  the woken grin, the celebration ring at a real completion only.
- **Themes** dress the Spark's ground in the game — the journey road
  and the record screen. The worlds keep their own skies; a site-born
  theme frames the road and never repaints a world. The one exception
  is the game-born Floating Isles Theme, which lives inside the worlds
  because it was born there.
- **Sound goods** voice the hero: chirps pitched by the hero's own seed
  take the set's family; the earned hums are hummed on the road.

**43 of the 65 goods have a game form. 22 do not, and say so on their
own cards** — the five sticker sets and the seventeen home goods, each
carrying the same plain sentence: *"This one lives on the site and in
the app; the game is not its country"*, with its reason. Stickers belong
to the keeper's messages; home goods furnish a home ground, and the
game has none — its grounds are the road and the worlds. No game
presence was invented for them.

## The wardrobe mapping — one id space

The game's wardrobe (SPARK! Wake the World) holds 13 pieces in 4 slots.
Against the catalogue they stand in three relations, recorded in the
catalogue's `unified.wardrobeMapping` and pinned by test:

| Game piece | Slot | Relation | Catalogue id |
|---|---|---|---|
| Ember Cap | hat | game-native | — |
| Moon Circlet | hat | slot-kin | the-ember-circlet |
| Star Crown | hat | game-native | — |
| Comet Crest | hat | game-native | — |
| Dawn Wrap | wrap | game-native | — |
| River Wrap | wrap | game-native | — |
| Storm Wrap | wrap | **same good** | the-storm-wrap |
| Petal Trail | trail | **same good** | petal-drift |
| Comet Trail | trail | **same good** | comet-trail---spark! |
| Prism Trail | trail | game-native | — |
| Candle Glow | glow | game-native | — |
| Hearth Glow | glow | game-native | — |
| Aurora Glow | glow | game-native | — |

- **Same good (3):** one piece, one catalogue id in both places. The
  game's placeholder product id for the Storm Wrap retires to the
  catalogue id. The comet trail is the catalogue's own declared case:
  it keeps two entries — Comet Tail for the site's sky, Comet Trail —
  SPARK! for the game's — and declares them the same good; owning
  either entry is owning the trail.
- **Slot-kin (1):** the Moon Circlet and the Ember Circlet are circlet
  for circlet — the game's is moon-silver and earned by waking, the
  catalogue's is ember-gold and a First Edition. Kin in form and slot;
  each keeps its own road and its own id. They are not merged, and this
  record does not pretend they are.
- **Game-native (9):** pieces the game grew itself, with no catalogue
  twin. The six earned ones (Ember Cap, Star Crown, Dawn Wrap, River
  Wrap, Candle Glow, Hearth Glow) are the game's own honours and stay
  so. The three purchasable ones — **Comet Crest, Prism Trail, Aurora
  Glow — have no catalogue id, and under this law they cannot be sold
  anywhere until the catalogue carries them**: the catalogue is the one
  price book, and their placeholder product ids stay inert until then.

**One judgment, stated plainly for Aaron's ruling:** where a piece has
both a game road and a stall road (the Petal Trail is earned in the
game at five worlds woken and is the $7 Petal Drift at the stall),
owning is owning — the record carries the id either way — and the
honour is kept in the record's word, `obtained: earned` against
`obtained: purchased`, never in exclusive possession. Bought goods
never imitate the earned mark; that is the catalogue's standing fence,
and it is what keeps both roads honest. The catalogue's earned-only
tier (the two hum shelves) has no purchasable twin anywhere, and never
will.

## What every good now carries

On top of its standing detail (what / means / kinds / design), each of
the 65 goods gained, in the keeper's plain register:

- **`detail.story`** — its story, written from the good's own record
  only: its issue facts where it has them (First Edition, Moon 8,
  Pattern Day 221; the Moon 9 windows; the seed-variant's one-of-one;
  earned, never sold), and the thread of its own design. No invented
  lore.
- **`use`** — the strategy, one line per platform where the good has a
  form (`site` / `app` / `game`): a real act a keeper does with it,
  not an adjective.
- **`gamePresence`** — what it does in the game, visually and audibly
  only, or the plain no-country sentence where it has no game form.
- **`worth`** — one plain sentence: why it is worth its band. The claim
  "bought once, worn everywhere your Spark goes" is used only where
  the good truly has all three forms; two-form goods say "on the site
  and in the app" and no more.

The stall's detail card renders the new fields as two new sections —
**How you'll use it** (the per-platform use lines) and **In the game**
(shown only where a game form exists) — and **Its story** now reads
`detail.story`, falling back to the rarity note. Prices are
byte-identical across all 65 (script-verified); the two earned-only
goods remain price-null and refused by the stall's existing law.

## Fences

- The Spark itself is never an item, on any platform.
- Earned-only goods are never purchasable on any platform.
- Nothing is sold to children, on any platform.
- No good's new text promises power: a language lint in the tests bars
  the power words (stronger, faster, extra shot, retry, unlock, easier,
  bonus power, and their kin) from every new field.
- The Token Shelf stays drawn empty; Aaron's Laws are nowhere in the
  catalogue; no price moved.

## Honest limits — what this build is and is not

This build is the catalogue, the law, and the site rendering. The
carrying itself rides on pieces already standing or already building:
the stall writes the goods record at purchase (landed with the stall
road); the story build now running adds wardrobe ids to the Spark's
carried record in the game. What remains future work, named so nobody
mistakes it for done: the game reading the full catalogue id space
(beyond its 13-piece wardrobe), and Living Day rendering each good's
ground form. The design above is written so both can land without a
single id changing.
