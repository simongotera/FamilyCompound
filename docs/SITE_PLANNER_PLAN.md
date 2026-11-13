# Interactive site planner — design proposal

**Status: proposal. Nothing here is built yet, and nothing will be until Simon approves the
direction.** This document exists so we can argue about the shape of the thing before spending
weeks on it.

## What it is

A visual tool inside The Compound where the family designs the land together: draw the parcel
boundary, place homes, orchards, gardens, water, solar, paths and permaculture zones, and see
each other's proposals side by side. It is the collaborative version of
[Phase 5 of AFTER_LOCATION.md](AFTER_LOCATION.md#phase-5--master-planning-with-permaculture-zones)
— which currently means one person with a pen and everyone else nodding.

**What it is not.** Not CAD. Not a permit drawing. Not a GIS analysis suite. Not a replacement
for a surveyor or an engineer. If it starts growing precise setback compliance or structural
anything, we have lost the plot. Its job is **shared understanding and honest argument**, and
its output is a plan a professional can then work from.

## Why it's worth building

1. The master plan is the highest-stakes collaborative decision in the whole project, and it's
   the one we currently have no tool for.
2. Everything else in the app is lists. The land is a *place*; a list can't show that the
   orchard shades the garden in March, or that two households have each quietly assumed the
   same knoll.
3. Disagreements about space are much easier to resolve when you can see them. "Your house is
   where I pictured the pond" is a five-minute conversation with a map and a five-year grudge
   without one.
4. It's the piece most worth open-sourcing. Many solarpunk and intentional-community projects
   face exactly this problem and there's no friendly, free tool for it.

---

## User experience

### The core loop

Open a **site** (one parcel) → see the **plan canvas** → draw or move things → leave a comment
or a reaction → compare with someone else's **scenario** → the group picks one and it becomes
the current plan, logged on the Decisions page.

### The canvas

A top-down map of the parcel. Pan and zoom. Underneath it, optional layers:

- **Base**: plain paper (always works, no network), or a satellite/aerial tile layer, or an
  uploaded image (a survey PDF photographed, a drone shot) that the user positions by dragging
  two reference points.
- **Contours / slope**, if we have elevation data — shaded so steep ground is visibly steep.
- **Sun**: a shadow overlay for a chosen date and time, with a slider to scrub through the day
  and a season toggle. This is the single most convincing feature for siting decisions.
- **Water**: where water flows downhill across the drawn terrain, roughly.
- **Zones**: the permaculture zone 0–5 bands, as coloured regions you draw.
- **Sectors**: arrows for prevailing wind, fire approach, noise, winter and summer sun angles.

### The things you place

A small, opinionated palette, each with a few properties and a sensible default size:

| Element | Shape | Properties worth having |
|---|---|---|
| Parcel boundary | polygon | area, computed automatically |
| Dwelling | rectangle / polygon | household, floors, status (planned/built) |
| Shared building | rectangle | kind (kitchen, workshop, barn) |
| Orchard block | polygon | species, variety, rootstock, spacing, planting year |
| Individual tree | point | species, variety, planting date, notes |
| Garden bed | polygon | annual / perennial |
| Water body | polygon | pond, tank, swale, spring, well (point) |
| Pipe / channel | line | diameter, gravity-fed or pumped |
| Solar array | polygon | kW, tilt, azimuth |
| Path / road | line | width, surface |
| Fence / windbreak | line | kind, height |
| Permaculture zone | polygon | zone number 0–5 |
| Sector arrow | arrow | what it represents |
| Note / pin | point | free text, discussion thread |

Everything snaps loosely (to a grid, to other shapes' edges) but nothing is precise, and the
UI should never pretend otherwise. Measurements shown as "about 0.4 ha", not "0.4127 ha".

### Working together

**Scenarios.** The heart of it. Anyone can fork the current plan into a named scenario — "Lucía's
version with the pond higher" — change whatever they like, and share it. Scenarios are compared
side by side, or as an A/B swipe over the same canvas. Only one scenario is ever "the current
plan", and promoting a scenario to current is a group decision that writes an entry on the
Decisions page.

This matters more than real-time multiplayer cursors. Family land planning happens over months,
asynchronously, across time zones — not in a shared hour.

**Comments.** Pin a comment anywhere on the canvas; it threads. Comments survive scenario forks.

**Reactions.** A lightweight per-scenario "I could live with this / I have a concern" from each
member, mirroring the consent decision rule in AFTER_LOCATION.md. It shows at a glance whether a
plan is actually agreed or just unopposed.

**History.** A scrubber through every saved version of the plan, so the 10-year evolution of the
place is visible. For a project whose trees take a decade, this is a feature, not a nicety.

### Phone

Read, comment and react on a phone; draw on a laptop or tablet. Trying to make polygon drawing
pleasant on a phone would cost more than it's worth. Standing on the land with a phone and
dropping a pin at your feet (using the device's GPS) *is* worth it, and is the one mobile
drawing feature to build.

### Accessibility and plain honesty

Every element has a text name and the plan has a readable list view, so it works with a screen
reader and so it prints. The sun overlay must say its assumptions ("flat ground, ignores trees
and buildings") rather than implying precision it doesn't have.

---

## Data model

Deliberately boring, portable, and not tied to any rendering library. Geometry in **local
metres** on a flat plane, with a single georeference on the site, so that everything works
offline and without a projection library, and can still be exported to GeoJSON later.

```
sites
  id, land_option_id (nullable FK to land_options), name,
  origin_lat, origin_lng,      -- georeference for the local (0,0)
  rotation_deg,                -- true north vs canvas up
  area_hectares,               -- computed, cached
  created_by, created_at

site_scenarios
  id, site_id, name, description,
  parent_scenario_id (nullable), -- what it was forked from
  is_current boolean,            -- exactly one true per site
  created_by, created_at

site_features
  id, scenario_id,
  kind,            -- 'dwelling' | 'orchard' | 'water' | 'path' | 'zone' | ...
  geometry_type,   -- 'point' | 'line' | 'polygon'
  coordinates,     -- jsonb: [[x,y], ...] in metres from origin
  properties,      -- jsonb, schema per kind (species, kW, household, ...)
  label, z_index,
  created_by, created_at, updated_at

site_layers           -- uploaded base images, georeferenced by the user
  id, site_id, kind,  -- 'image' | 'contours' | 'satellite'
  storage_path, transform jsonb, opacity, visible_by_default

site_comments
  id, scenario_id, x, y,       -- pinned to a place, not a feature
  parent_comment_id, body, author_id, resolved, created_at

site_reactions
  id, scenario_id, member_id,
  stance,          -- 'consent' | 'concern' | 'object'
  note, created_at

site_versions         -- a snapshot of a scenario's features, for history
  id, scenario_id, snapshot jsonb, label, created_by, created_at
```

**Why `jsonb` for geometry and properties.** We need PostGIS-grade querying approximately never
— the biggest site will hold a few hundred features, all loaded at once and manipulated in the
browser. Plain JSON keeps the stack unchanged, keeps the data trivially exportable, and keeps
the open-source version runnable on any Postgres. If we ever need real spatial queries, PostGIS
is an additive migration, not a rewrite.

**RLS** follows the pattern the quiz migration already uses: any member of the compound can read
everything; you can only write your own scenarios, comments and reactions; promoting a scenario
to current is restricted and logged.

**Export** is non-negotiable for an open-source tool and for not trapping the family's work:
GeoJSON (coordinates projected back to lat/lng via the site origin), a PNG or PDF of the current
view for printing and for the lawyer, and a CSV of the orchard features that doubles as the tree
register Phase 7 asks for.

---

## Technology options

### Rendering

**Option A — SVG + React, hand-rolled.**
Features are React components; pan/zoom is a transform on a `<g>`.
*Pros:* no dependency; trivially themeable with the existing CSS variables; accessible by
default (real DOM nodes, focusable, labelled); prints beautifully; by far the smallest thing to
maintain and for an outside contributor to understand.
*Cons:* we write the drawing interactions (drag handles, vertex editing, snapping) ourselves —
that's the real cost, maybe a week of fiddly work; performance degrades somewhere in the low
thousands of nodes, which is far beyond what a homestead plan needs.

**Option B — Canvas via Konva / Fabric.**
*Pros:* drag, transform and hit-testing out of the box; handles many more objects.
*Cons:* a sizeable dependency; accessibility and printing must be rebuilt by hand; styling sits
outside the app's CSS; we'd be using maybe 10% of it.

**Option C — A real map stack (MapLibre GL, or Leaflet + Geoman).**
*Pros:* satellite imagery, true georeferencing, standard GeoJSON editing tools, familiar
behaviour.
*Cons:* heavy; needs a tile provider (an account, a key, and a cost or usage limit) which
undercuts the "clone it and run it" promise for other communities; awkward offline; forces
everything into lat/lng when a 12-hectare site is much easier to reason about in metres;
styling it to look like the rest of the app is a fight.

**Option D — Embed an existing open-source tool** (e.g. an excalidraw-style canvas).
*Pros:* good drawing UX immediately.
*Cons:* generic shapes, no domain model — we'd get a whiteboard, not a site planner, and the
orchard register, zone areas and sun overlay all become impossible.

### Recommendation: **A (SVG + React), with C available later as a base layer**

The domain model is the valuable part, not the drawing engine. SVG keeps the stack exactly as it
is today (Next.js, React, Supabase, Tailwind, no new runtime dependency), keeps the thing
accessible and printable, and makes the open-source version a `git clone` with no API keys.
A satellite base layer is genuinely useful but is an *optional layer* — add MapLibre behind a
feature flag in a later phase, for people who want it, without making the core depend on it.

For the one piece of real maths — sun position for the shadow overlay — use a small, well-tested
solar-position library rather than writing the astronomy ourselves; it's a few kilobytes and the
formulas are easy to get subtly wrong.

### Open-sourcing

Worth designing for from the start, cheaply:

- Keep the planner in its own directory (`lib/siteplanner/`, `components/siteplanner/`) with no
  imports from Compound-specific code except a thin adapter for auth and storage.
- Put the schema in its own migration file.
- No API keys required for the core experience.
- MIT or AGPL — Simon's call. AGPL fits the solarpunk ethos better (improvements come back);
  MIT gets more adoption.
- Split it into its own repository only when someone outside actually wants it; premature
  extraction is a tax on every change.

---

## Phases

**Phase 1 — Static plan (about a week).** Draw the boundary, place rectangles and polygons,
name them, save, reload. One plan per site, no scenarios. Area calculations. Already useful.

**Phase 2 — The domain (about a week).** The real element palette with per-kind properties, the
orchard register, permaculture zone regions, the legend, and PNG/GeoJSON/CSV export.

**Phase 3 — Together (about a week).** Scenarios, forking, side-by-side comparison, pinned
comments, consent reactions, promoting a scenario to current with a Decisions entry.

**Phase 4 — Overlays (one to two weeks).** Uploaded georeferenced base image; sun and shadow
overlay with a time scrubber; sector arrows; contours if we have elevation data.

**Phase 5 — Polish and open source (about a week).** Version history scrubber, phone read/comment
view, GPS pin-dropping on site, README, licence, demo data, extraction.

Phases 1–3 are the ones that earn their keep. Phase 4 is the one that will make the family
actually enjoy using it. Phase 5 only happens if we want to share it.

---

## Risks and honest doubts

- **Scope creep into CAD.** The guard: no dimension is ever shown to more than two significant
  figures, and we never add anything a builder would need to be precise.
- **It might go unused.** The family uses lists today. Mitigation: build Phase 1 only, put a
  real parcel in it, and see whether anyone opens it twice before building Phase 2.
- **It only becomes real after we own land.** Partly true — but it's also the tool for arguing
  about *candidate* parcels during due diligence, which is now.
- **Sun overlays imply false precision.** Mitigation: label the assumptions on the overlay
  itself, every time.
- **Drawing UX is deceptively hard.** This is the real schedule risk in Phase 1, and the reason
  to build Phase 1 before promising anything else.

---

## The tiny clickable prototype — built

It exists now, at **`/site-planner-prototype`** (deliberately not in the nav):
[app/site-planner-prototype/page.js](../app/site-planner-prototype/page.js).

A fixed example parcel with three draggable buildings, a draggable orchard polygon and pond, a
permaculture-zone overlay, and a time-of-day slider with a midsummer/midwinter toggle that casts
shadows from the buildings. Areas are computed from the geometry (shoelace formula). No
database, no auth, no saving — reload and it resets.

What it was built to answer:

- **Does dragging in plain SVG feel good enough?** Yes. Pointer events with pointer capture,
  snapping to the metre, about 40 lines. This was the main schedule risk in Phase 1 and it is
  smaller than feared.
- **Does it look like The Compound?** Yes — it uses the same CSS variables and fonts, no styling
  fight, which is the thing a map stack would have cost us.
- **Is the sun overlay the convincing feature?** Yes. Dragging a house and watching the midwinter
  afternoon shadow fall across the garden makes a siting argument concrete in a way a list never
  will. Worth moving earlier than Phase 4.

The sun model is crude on purpose — flat ground, 6 m walls, a generic latitude — and the page
says so on screen. The real version would use the site's own latitude and a proper
solar-position library.

---

## The decision Simon needs to make

1. **Build it at all?** Or is a paper plan and a photo enough for now?
2. **SVG (recommended) or a real map stack?** This is the one choice that's expensive to reverse.
3. **Scenarios-and-comments, or just one shared plan?** Scenarios are the collaborative heart,
   and about a third of the work.
4. **Open source from the start, or decide later?** Designing for it is nearly free; doing it
   is not.
5. **Prototype first, or straight into Phase 1?**

Nothing will be built until these are answered.
