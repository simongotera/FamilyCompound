'use client'

// Throwaway prototype for docs/SITE_PLANNER_PLAN.md — the half-day sketch described there.
// Deliberately: no database, no auth, no saving. Reload and it's back to the start.
// It exists to answer two questions before we commit to building the real thing:
//   1. Does dragging things around an SVG plan feel good enough?
//   2. Does it look like The Compound?
// Not linked from the nav. Visit /site-planner-prototype directly.

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'

// Everything is in metres. The viewBox is the parcel's bounding box plus a margin,
// which is the whole reason the proposal argues for local metres over lat/lng.
const VIEW = { w: 200, h: 140 }

const PARCEL = [
  [12, 10], [186, 18], [182, 96], [140, 128], [36, 122], [8, 72],
]

const INITIAL = {
  dwellings: [
    { id: 'd1', label: 'Main house', x: 60, y: 44, w: 16, h: 11 },
    { id: 'd2', label: 'Second home', x: 88, y: 40, w: 14, h: 10 },
    { id: 'd3', label: 'Workshop', x: 62, y: 62, w: 12, h: 8 },
  ],
  orchard: { id: 'o1', label: 'Orchard', points: [[104, 62], [162, 56], [168, 96], [112, 100]] },
  pond: { id: 'w1', label: 'Pond', cx: 44, cy: 92, rx: 13, ry: 9 },
}

const ZONES = [
  { zone: 1, r: 22, label: 'Zone 1 · daily' },
  { zone: 2, r: 40, label: 'Zone 2 · a few times a week' },
  { zone: 3, r: 64, label: 'Zone 3 · weekly' },
]
const ZONE_CENTRE = [70, 50]

// Shoelace formula — signed area of a simple polygon, in m².
function polygonArea(points) {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}

function hectares(m2) {
  return (m2 / 10000).toFixed(2)
}

// Monotone-chain convex hull, used to turn a building plus its offset copy into one shadow.
function hull(points) {
  const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const build = (src) => {
    const out = []
    for (const p of src) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop()
      out.push(p)
    }
    out.pop()
    return out
  }
  return [...build(pts), ...build([...pts].reverse())]
}

// A deliberately crude sun model. Bearings are clockwise from north; on screen north is up,
// so a bearing B is the direction (sin B, -cos B). The shadow points away from the sun.
// Flat ground, no terrain, no trees. The UI says so, because it would be easy to over-trust.
function shadowVector(hour, maxAltitude) {
  const f = (hour - 6) / 12 // 0 at 06:00, 1 at 18:00
  const azimuth = 90 + f * 180 // east → south → west
  const altitude = Math.max(2, maxAltitude * Math.sin(Math.PI * f))
  const bearing = ((azimuth + 180) % 360) * (Math.PI / 180)
  const lengthPerMetreOfHeight = 1 / Math.tan((altitude * Math.PI) / 180)
  return {
    dx: Math.sin(bearing) * lengthPerMetreOfHeight,
    dy: -Math.cos(bearing) * lengthPerMetreOfHeight,
    altitude,
  }
}

export default function Page() {
  const svgRef = useRef(null)
  const drag = useRef(null)
  const [dwellings, setDwellings] = useState(INITIAL.dwellings)
  const [orchard, setOrchard] = useState(INITIAL.orchard)
  const [pond, setPond] = useState(INITIAL.pond)
  const [showZones, setShowZones] = useState(true)
  const [showSun, setShowSun] = useState(true)
  const [hour, setHour] = useState(9)
  const [season, setSeason] = useState('summer')
  const [selected, setSelected] = useState(null)

  const maxAltitude = season === 'summer' ? 68 : 24
  const sun = useMemo(() => shadowVector(hour, maxAltitude), [hour, maxAltitude])

  const parcelArea = useMemo(() => polygonArea(PARCEL), [])
  const orchardArea = useMemo(() => polygonArea(orchard.points), [orchard])

  // Convert a pointer event to metres in the plan's own coordinate system.
  function toPlan(e) {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * VIEW.w,
      y: ((e.clientY - rect.top) / rect.height) * VIEW.h,
    }
  }

  function startDrag(e, kind, id) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toPlan(e)
    const item = kind === 'dwelling' ? dwellings.find((d) => d.id === id) : kind === 'pond' ? pond : orchard
    const anchor = kind === 'dwelling' ? [item.x, item.y] : kind === 'pond' ? [item.cx, item.cy] : item.points[0]
    drag.current = { kind, id, offX: p.x - anchor[0], offY: p.y - anchor[1] }
    setSelected(`${kind}:${id}`)
  }

  function onDrag(e) {
    if (!drag.current) return
    const p = toPlan(e)
    // Snap to the metre. Loose on purpose — this is a sketch, not a survey.
    const nx = Math.round(p.x - drag.current.offX)
    const ny = Math.round(p.y - drag.current.offY)
    const { kind, id } = drag.current
    if (kind === 'dwelling') {
      setDwellings((prev) => prev.map((d) => (d.id === id ? { ...d, x: nx, y: ny } : d)))
    } else if (kind === 'pond') {
      setPond((prev) => ({ ...prev, cx: nx, cy: ny }))
    } else {
      setOrchard((prev) => {
        const [ox, oy] = prev.points[0]
        const ddx = nx - ox
        const ddy = ny - oy
        return { ...prev, points: prev.points.map(([x, y]) => [x + ddx, y + ddy]) }
      })
    }
  }

  function endDrag() {
    drag.current = null
  }

  function reset() {
    setDwellings(INITIAL.dwellings)
    setOrchard(INITIAL.orchard)
    setPond(INITIAL.pond)
    setSelected(null)
  }

  const shadows = dwellings.map((d) => {
    const height = 6 // a single storey plus roof, near enough for a sketch
    const corners = [[d.x, d.y], [d.x + d.w, d.y], [d.x + d.w, d.y + d.h], [d.x, d.y + d.h]]
    const moved = corners.map(([x, y]) => [x + sun.dx * height, y + sun.dy * height])
    return { id: d.id, points: hull([...corners, ...moved]) }
  })

  const pts = (points) => points.map(([x, y]) => `${x},${y}`).join(' ')

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
        <h1 className="font-display text-3xl" style={{ color: 'var(--pine-dark)' }}>Site planner — prototype</h1>
        <Link href="/" className="text-sm underline decoration-dotted underline-offset-4" style={{ color: 'var(--clay)' }}>
          ← Back to The Compound
        </Link>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--ink)' }}>
        A sketch to decide whether the real tool is worth building — see{' '}
        <span className="italic">docs/SITE_PLANNER_PLAN.md</span>. Drag the buildings, the orchard and the pond.
        Nothing is saved: reload and it returns to the start.
      </p>

      <div className="rounded-lg border p-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-3" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showZones} onChange={(e) => setShowZones(e.target.checked)} />
          Permaculture zones
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showSun} onChange={(e) => setShowSun(e.target.checked)} />
          Shadows
        </label>
        <label className="flex items-center gap-2 text-sm">
          Season
          <select value={season} onChange={(e) => setSeason(e.target.value)} className="border rounded px-2 py-1 bg-white text-sm" style={{ borderColor: 'var(--line)' }}>
            <option value="summer">Midsummer</option>
            <option value="winter">Midwinter</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm flex-1 min-w-55">
          <span className="whitespace-nowrap tabular-nums">{String(Math.floor(hour)).padStart(2, '0')}:{hour % 1 ? '30' : '00'}</span>
          <input
            type="range" min={6} max={18} step={0.5} value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="flex-1" style={{ accentColor: 'var(--clay)' }}
            aria-label="Time of day"
          />
        </label>
        <button type="button" onClick={reset} className="text-sm underline decoration-dotted underline-offset-4" style={{ color: 'var(--clay)' }}>
          Reset
        </button>
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--line)' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          className="w-full block touch-none"
          style={{ background: '#E4DECE' }}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          role="img"
          aria-label="Draggable plan of the land"
        >
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--line)" strokeWidth="0.2" />
            </pattern>
            <clipPath id="parcelClip"><polygon points={pts(PARCEL)} /></clipPath>
            <clipPath id="orchardClip"><polygon points={pts(orchard.points)} /></clipPath>
          </defs>

          <g clipPath="url(#parcelClip)">
            <rect width={VIEW.w} height={VIEW.h} fill="var(--paper)" />
            <rect width={VIEW.w} height={VIEW.h} fill="url(#grid)" />
          </g>
          <polygon points={pts(PARCEL)} fill="none" stroke="var(--pine-dark)" strokeWidth="0.9" strokeDasharray="3 1.5" />

          {showZones && (
            <g clipPath="url(#parcelClip)" opacity="0.5">
              {[...ZONES].reverse().map((z) => (
                <circle key={z.zone} cx={ZONE_CENTRE[0]} cy={ZONE_CENTRE[1]} r={z.r}
                  fill="var(--pine)" fillOpacity={0.07} stroke="var(--pine)" strokeWidth="0.3" strokeDasharray="1 1" />
              ))}
            </g>
          )}

          {showSun && (
            <g clipPath="url(#parcelClip)">
              {shadows.map((s) => <polygon key={s.id} points={pts(s.points)} fill="var(--ink)" opacity="0.16" />)}
            </g>
          )}

          {/* Orchard */}
          <g onPointerDown={(e) => startDrag(e, 'orchard', orchard.id)} style={{ cursor: 'grab' }}>
            <polygon
              points={pts(orchard.points)}
              fill="var(--pine)" fillOpacity="0.28"
              stroke={selected === `orchard:${orchard.id}` ? 'var(--clay)' : 'var(--pine-dark)'}
              strokeWidth={selected === `orchard:${orchard.id}` ? 1.1 : 0.6}
            />
            {/* a few trees, so it reads as an orchard rather than a green blob */}
            <g clipPath="url(#orchardClip)">
              {Array.from({ length: 12 }).map((_, i) => {
                const col = i % 4
                const row = Math.floor(i / 4)
                const [bx, by] = orchard.points[0]
                return <circle key={i} cx={bx + 9 + col * 14} cy={by + 9 + row * 12} r="3.2" fill="var(--pine-dark)" opacity="0.55" />
              })}
            </g>
            <text x={orchard.points[0][0] + 4} y={orchard.points[0][1] - 3} fontSize="4.5" fill="var(--pine-dark)">
              {orchard.label} · {hectares(orchardArea)} ha
            </text>
          </g>

          {/* Pond */}
          <g onPointerDown={(e) => startDrag(e, 'pond', pond.id)} style={{ cursor: 'grab' }}>
            <ellipse cx={pond.cx} cy={pond.cy} rx={pond.rx} ry={pond.ry}
              fill="#6E8CA0" fillOpacity="0.55"
              stroke={selected === `pond:${pond.id}` ? 'var(--clay)' : '#4A6273'} strokeWidth="0.5" />
            <text x={pond.cx - pond.rx} y={pond.cy - pond.ry - 2} fontSize="4.5" fill="var(--pine-dark)">{pond.label}</text>
          </g>

          {/* Dwellings */}
          {dwellings.map((d) => (
            <g key={d.id} onPointerDown={(e) => startDrag(e, 'dwelling', d.id)} style={{ cursor: 'grab' }}>
              <rect x={d.x} y={d.y} width={d.w} height={d.h}
                fill="var(--clay)" fillOpacity="0.9"
                stroke={selected === `dwelling:${d.id}` ? 'var(--pine-dark)' : 'var(--clay)'}
                strokeWidth={selected === `dwelling:${d.id}` ? 1.1 : 0.4} rx="0.8" />
              <text x={d.x + d.w / 2} y={d.y + d.h + 5} fontSize="4.5" textAnchor="middle" fill="var(--pine-dark)">{d.label}</text>
            </g>
          ))}

          {/* North arrow and scale bar */}
          <g transform="translate(172, 112)" opacity="0.8">
            <path d="M 0 10 L 0 -6 M 0 -8 L -2.4 -3 L 0 -4.4 L 2.4 -3 Z" stroke="var(--pine-dark)" strokeWidth="0.6" fill="var(--pine-dark)" />
            <text x="4" y="-3" fontSize="5" fill="var(--pine-dark)">N</text>
          </g>
          <g transform="translate(14, 128)">
            <line x1="0" y1="0" x2="20" y2="0" stroke="var(--pine-dark)" strokeWidth="0.7" />
            <line x1="0" y1="-1.5" x2="0" y2="1.5" stroke="var(--pine-dark)" strokeWidth="0.7" />
            <line x1="20" y1="-1.5" x2="20" y2="1.5" stroke="var(--pine-dark)" strokeWidth="0.7" />
            <text x="22" y="1.6" fontSize="4.5" fill="var(--pine-dark)">20 m</text>
          </g>
        </svg>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-4">
        <div className="rounded-lg border p-4" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--clay)' }}>Areas</p>
          <p className="text-sm">Parcel about {hectares(parcelArea)} ha</p>
          <p className="text-sm">Orchard about {hectares(orchardArea)} ha</p>
          <p className="text-sm">{dwellings.length} dwellings</p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--clay)' }}>Sun</p>
          <p className="text-sm">Altitude about {sun.altitude.toFixed(0)}°</p>
          <p className="text-sm" style={{ color: 'var(--ink)' }}>
            Flat ground, 6 m walls, no terrain or trees, and a generic latitude. Indicative only —
            the real tool would use the site&apos;s own latitude.
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--clay)' }}>Not built yet</p>
          <p className="text-sm" style={{ color: 'var(--ink)' }}>
            Saving, scenarios, comments, drawing new shapes, resizing, uploaded maps. Those are
            phases 1–4 in the proposal.
          </p>
        </div>
      </div>
    </main>
  )
}
