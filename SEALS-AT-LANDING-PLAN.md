# Seals at landing — the new pipeline rule (foundation F6)

Plain words first. The **seals** are the generated files under `site-audit/r2/`
(the master inventory, the resource registry, the approved-public manifest, and
their sibling reports). They are a signed-off snapshot of the whole repository:
every tracked file, its hash, its group, and whether it may be published. They
prove that the tree they were generated from is the tree they describe.

## The old way, and why it changed

Every branch used to regenerate the seals and commit them. Two branches working
at the same time each rewrote the same two big seal files from different bases,
so when they landed, the seals collided — PR #173 and PR #184 both paid a
refresh merge, a full regeneration (the document extract alone takes ~27
minutes), and an extra deploy for a conflict in files no human ever edits.
The seals are a property of the **landed tree**, not of any branch. Committing
them per branch manufactured conflicts and bought nothing.

## The new way

**Branches validate; seals regenerate once, at landing.**

- A feature branch carries main's seal files **untouched**. It never runs the
  inventory generator to commit its output.
- `npm run validate` is the branch gate. Its seal step
  (`npm run r2:inventory:check:branch`) checks **consistency**, not freshness:
  - the committed seals must be a valid landing seal (their frozen-source
    integrity proof must match);
  - they must come from a commit that is an ancestor of the branch (main's
    seals, carried — never a branch's own);
  - the branch must not have changed any seal file — if it has, the check
    fails and says why;
  - the content guards stay strict on every branch: the frozen-source hash
    proof is recomputed, and any unclassified file fails generation;
  - staleness is **reported, not failed**: the check prints how many
    inventoried files this branch changed, added, or removed, and names the
    seal outputs that will be regenerated at landing.
- The registry tests follow the same split. Files a branch did not touch are
  hash-checked against the committed seals exactly as before. Protected files
  (the frozen archive, the ledger, the public Scroll copy) are hash-checked
  always — no branch may move them behind a pending re-seal. Files the branch
  did change are checked for internal consistency (the approved-public
  manifest must agree with the sealed registry) until landing proves them
  against disk.

## Landing, step by step (on main, after the merge)

```sh
git checkout main && git pull
npm run site:seal
git add site-audit/r2 docs/data docs/assets/search  # whatever the seal regenerated
git commit -m "seal: regenerate R2 seals for <what landed>"
npm run validate:landing
git push
```

- `npm run site:seal` regenerates everything once, in the canonical order:
  site catalog → search index → document extract (`python3` with `pypdf`
  available) → R2 inventory.
- `npm run validate:landing` is the strict gate that used to be plain
  `validate`: the committed seals must byte-match the landed tree. **Main must
  never sit with seals that do not match its tree once a landing completes** —
  if `validate:landing` fails, regenerate and amend the seal commit before
  pushing.
- One landing, one seal commit, no matter how many branches landed that day:
  batch the day's merges, then seal once.

## What did not change

- The strict check itself (`npm run r2:inventory:check`) is untouched and is
  still the landing gate.
- No content-guard test was removed. The frozen-source proof, the
  never-approved-public groups, the classification coverage, and the
  extraction-evidence tests all run at full strength on every branch.
- The site catalog and search index still regenerate on branches when pages
  change: they live in the published tree, other tests read them as ground
  truth, and they have not produced the collision pattern the seals did.
  Only the `site-audit/r2/` seal set moved to landing-time.
