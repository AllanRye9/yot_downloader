/**
 * PropertyManager — Property management dashboard with:
 *   - Tabbed navigation: Dashboard | Properties | Agents | Map View
 *   - Property list with status management (Empty / Occupied / Soon Empty)
 *   - Closest available property identification
 *   - Interactive map with property pins
 *   - Agent list sorted by distance with "Show more" pagination
 *
 * Uses demo data since this feature ships as a UI-only prototype.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import PropertyMap from './PropertyMap'

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_PROPERTIES = [
  { id: 1, address: '12 Oak Street, London', lat: 51.513, lng: -0.078, status: 'empty',      size: '2-bed flat',  available_date: '2026-04-01', agent_id: 1 },
  { id: 2, address: '8 Maple Avenue, London', lat: 51.501, lng: -0.117, status: 'occupied',  size: '3-bed house', available_date: null,         agent_id: 2 },
  { id: 3, address: '34 Pine Road, London',   lat: 51.529, lng: -0.102, status: 'soon_empty',size: '1-bed studio',available_date: '2026-05-15', agent_id: 3 },
  { id: 4, address: '5 Elm Close, London',    lat: 51.491, lng: -0.063, status: 'empty',      size: '2-bed flat',  available_date: '2026-04-10', agent_id: 1 },
  { id: 5, address: '21 Birch Lane, London',  lat: 51.521, lng: -0.134, status: 'occupied',  size: '4-bed house', available_date: null,         agent_id: 4 },
  { id: 6, address: '9 Cedar Court, London',  lat: 51.508, lng: -0.055, status: 'soon_empty',size: '2-bed flat',  available_date: '2026-06-01', agent_id: 2 },
]

const DEMO_AGENTS = [
  { id: 1, name: 'Alice Johnson', rating: 4.8, reviews: 34, lat: 51.515, lng: -0.082, avatar: '👩' },
  { id: 2, name: 'Bob Williams',  rating: 4.5, reviews: 21, lat: 51.499, lng: -0.121, avatar: '👨' },
  { id: 3, name: 'Carol Davis',   rating: 4.9, reviews: 47, lat: 51.527, lng: -0.108, avatar: '👩' },
  { id: 4, name: 'Dan Brown',     rating: 4.2, reviews: 18, lat: 51.487, lng: -0.059, avatar: '👨' },
  { id: 5, name: 'Eva Martinez',  rating: 4.6, reviews: 29, lat: 51.503, lng: -0.095, avatar: '👩' },
  { id: 6, name: 'Frank Lee',     rating: 4.3, reviews: 15, lat: 51.532, lng: -0.072, avatar: '👨' },
  { id: 7, name: 'Grace Kim',     rating: 4.7, reviews: 38, lat: 51.497, lng: -0.143, avatar: '👩' },
  { id: 8, name: 'Henry Chen',    rating: 4.4, reviews: 22, lat: 51.519, lng: -0.128, avatar: '👨' },
]

const AGENTS_PAGE_SIZE = 4

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR = { empty: '#6b7280', occupied: '#ef4444', soon_empty: '#22c55e' }
const STATUS_LABEL = { empty: 'Empty', occupied: 'Occupied', soon_empty: 'Soon Empty' }
const STATUS_BG    = { empty: '#6b728022', occupied: '#ef444422', soon_empty: '#22c55e22' }

function _haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function _stars(rating) {
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 9999,
      background: STATUS_BG[status] ?? '#6b728022',
      color: STATUS_COLOR[status] ?? '#6b7280',
      fontSize: '0.75rem',
      fontWeight: 700,
      border: `1px solid ${STATUS_COLOR[status] ?? '#6b7280'}44`,
    }}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function AgentCard({ agent, distKm }) {
  return (
    <div style={{
      background: '#1f2937',
      border: '1px solid #374151',
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: '#374151',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.5rem', flexShrink: 0,
      }}>
        {agent.avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#f3f4f6', fontSize: '0.88rem', fontWeight: 700 }}>{agent.name}</div>
        <div style={{ color: '#facc15', fontSize: '0.78rem', letterSpacing: '0.04em' }}>
          {_stars(agent.rating)}{' '}
          <span style={{ color: '#9ca3af' }}>{agent.rating.toFixed(1)}/5</span>
          <span style={{ color: '#6b7280', fontSize: '0.72rem' }}> ({agent.reviews} reviews)</span>
        </div>
        {distKm != null && (
          <div style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: 2 }}>
            📍 {distKm.toFixed(1)} km away
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Agent List panel ─────────────────────────────────────────────────────────

function AgentListPanel({ agents, refLat, refLng }) {
  const [shown, setShown] = useState(AGENTS_PAGE_SIZE)

  const sorted = useMemo(() => {
    if (refLat == null || refLng == null) return agents
    return [...agents]
      .map(a => ({ ...a, _dist: _haversineKm(refLat, refLng, a.lat, a.lng) }))
      .sort((a, b) => a._dist - b._dist)
  }, [agents, refLat, refLng])

  return (
    <div>
      <h3 style={{ color: '#d1d5db', fontSize: '0.9rem', fontWeight: 700, marginBottom: 10 }}>
        🧑‍💼 Nearest Agents
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.slice(0, shown).map(a => (
          <AgentCard key={a.id} agent={a} distKm={a._dist} />
        ))}
      </div>
      {shown < sorted.length && (
        <button
          type="button"
          onClick={() => setShown(s => s + AGENTS_PAGE_SIZE)}
          style={{
            marginTop: 12, width: '100%',
            padding: '8px 0', borderRadius: 8,
            background: '#1f2937', border: '1px solid #374151',
            color: '#9ca3af', fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Show more ({sorted.length - shown} remaining)
        </button>
      )}
    </div>
  )
}

// ─── Dashboard overview panel ─────────────────────────────────────────────────

function DashboardPanel({ properties, agents, userLocation, onSelectProperty, closestId }) {
  const counts = useMemo(() => ({
    empty:      properties.filter(p => p.status === 'empty').length,
    occupied:   properties.filter(p => p.status === 'occupied').length,
    soon_empty: properties.filter(p => p.status === 'soon_empty').length,
  }), [properties])

  const closest = properties.find(p => p.id === closestId)
  const [selectedId, setSelectedId] = useState(null)

  const handlePin = useCallback((prop) => {
    setSelectedId(prop.id)
    onSelectProperty?.(prop)
  }, [onSelectProperty])

  const refLat = userLocation?.lat ?? (properties[0]?.lat)
  const refLng = userLocation?.lng ?? (properties[0]?.lng)

  return (
    <div className="space-y-5">
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { label: 'Empty',      count: counts.empty,      status: 'empty' },
          { label: 'Occupied',   count: counts.occupied,   status: 'occupied' },
          { label: 'Soon Empty', count: counts.soon_empty, status: 'soon_empty' },
        ].map(c => (
          <div key={c.status} style={{
            background: '#1f2937', border: `1px solid ${STATUS_COLOR[c.status]}44`,
            borderRadius: 10, padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ color: STATUS_COLOR[c.status], fontSize: '1.6rem', fontWeight: 800 }}>{c.count}</div>
            <div style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Closest available callout */}
      {closest && (
        <div style={{
          background: '#22c55e11', border: '1px solid #22c55e44',
          borderRadius: 10, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.3rem' }}>⭐</span>
          <div>
            <div style={{ color: '#22c55e', fontSize: '0.82rem', fontWeight: 700 }}>Closest available property</div>
            <div style={{ color: '#d1d5db', fontSize: '0.85rem' }}>{closest.address}</div>
            <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>{closest.size} · {STATUS_LABEL[closest.status]}</div>
          </div>
        </div>
      )}

      {/* Map */}
      <div style={{ height: 320, borderRadius: 10, overflow: 'hidden', border: '1px solid #374151' }}>
        <PropertyMap
          properties={properties}
          selectedId={selectedId}
          onSelectProperty={handlePin}
          userLocation={userLocation}
          closestId={closestId}
        />
      </div>

      {/* Agent list */}
      <AgentListPanel agents={agents} refLat={refLat} refLng={refLng} />
    </div>
  )
}

// ─── Properties list panel ────────────────────────────────────────────────────

function PropertiesPanel({ properties, setProperties, onSelectOnMap }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = properties
    if (filter !== 'all') list = list.filter(p => p.status === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p => p.address.toLowerCase().includes(q))
    }
    return list
  }, [properties, filter, search])

  const cycleStatus = (id) => {
    const cycle = { empty: 'occupied', occupied: 'soon_empty', soon_empty: 'empty' }
    setProperties(prev => prev.map(p => p.id === id ? { ...p, status: cycle[p.status] } : p))
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by address…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 180px', padding: '7px 12px', borderRadius: 8,
            background: '#111827', border: '1px solid #374151',
            color: '#e5e7eb', fontSize: '0.82rem', outline: 'none',
          }}
        />
        {['all', 'empty', 'occupied', 'soon_empty'].map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer',
              border: filter === f ? `1.5px solid ${STATUS_COLOR[f] ?? '#6366f1'}` : '1px solid #374151',
              background: filter === f ? `${STATUS_COLOR[f] ?? '#6366f1'}22` : '#1f2937',
              color: filter === f ? (STATUS_COLOR[f] ?? '#a5b4fc') : '#9ca3af',
            }}
          >
            {f === 'all' ? 'All' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ color: '#6b7280', borderBottom: '1px solid #374151' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Address</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Size</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Available</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '24px 0' }}>
                  No properties match your filter.
                </td>
              </tr>
            )}
            {filtered.map(p => (
              <tr
                key={p.id}
                style={{ borderBottom: '1px solid #1f2937', transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1f2937'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <td style={{ padding: '9px 10px', color: '#e5e7eb' }}>{p.address}</td>
                <td style={{ padding: '9px 10px', color: '#9ca3af' }}>{p.size}</td>
                <td style={{ padding: '9px 10px' }}><StatusBadge status={p.status} /></td>
                <td style={{ padding: '9px 10px', color: '#9ca3af' }}>{p.available_date ?? '—'}</td>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => cycleStatus(p.id)}
                      title="Cycle status"
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem',
                        background: '#374151', border: '1px solid #4b5563',
                        color: '#d1d5db', cursor: 'pointer',
                      }}
                    >
                      ↻ Status
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectOnMap?.(p)}
                      title="Show on map"
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem',
                        background: '#1d4ed822', border: '1px solid #1d4ed844',
                        color: '#93c5fd', cursor: 'pointer',
                      }}
                    >
                      🗺 Map
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Agents panel ─────────────────────────────────────────────────────────────

function AgentsPanel({ agents, properties, selectedPropertyId }) {
  const selectedProp = properties.find(p => p.id === selectedPropertyId)
  const refLat = selectedProp?.lat
  const refLng = selectedProp?.lng

  const sorted = useMemo(() => {
    if (refLat == null || refLng == null) return agents
    return [...agents]
      .map(a => ({ ...a, _dist: _haversineKm(refLat, refLng, a.lat, a.lng) }))
      .sort((a, b) => a._dist - b._dist)
  }, [agents, refLat, refLng])

  const [shown, setShown] = useState(AGENTS_PAGE_SIZE)

  return (
    <div className="space-y-4">
      {selectedProp ? (
        <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
          Showing agents closest to: <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedProp.address}</span>
        </div>
      ) : (
        <div style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
          Select a property to sort agents by proximity, or view all agents alphabetically.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.slice(0, shown).map(a => (
          <AgentCard key={a.id} agent={a} distKm={a._dist} />
        ))}
      </div>
      {shown < sorted.length && (
        <button
          type="button"
          onClick={() => setShown(s => s + AGENTS_PAGE_SIZE)}
          style={{
            width: '100%', padding: '9px 0', borderRadius: 8,
            background: '#1f2937', border: '1px solid #374151',
            color: '#9ca3af', fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Show more ({sorted.length - shown} remaining)
        </button>
      )}
    </div>
  )
}

// ─── Map View panel ───────────────────────────────────────────────────────────

function MapViewPanel({ properties, userLocation, closestId, initialSelectedId = null }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const selectedProp = properties.find(p => p.id === selectedId)

  return (
    <div>
      {/* Full-height map */}
      <div style={{ height: 460, borderRadius: 10, overflow: 'hidden', border: '1px solid #374151', marginBottom: 16 }}>
        <PropertyMap
          properties={properties}
          selectedId={selectedId}
          onSelectProperty={p => setSelectedId(p.id)}
          userLocation={userLocation}
          closestId={closestId}
        />
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {Object.entries(STATUS_LABEL).map(([s, l]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#9ca3af' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[s] }} />
            {l}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: '#9ca3af' }}>
          <span style={{ color: '#facc15' }}>⭐</span> Closest available
        </div>
      </div>

      {/* Property list below map */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {properties.map(p => (
          <div
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
              background: selectedId === p.id ? '#1d4ed822' : '#1f2937',
              border: selectedId === p.id ? '1px solid #3b82f644' : '1px solid #374151',
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: STATUS_COLOR[p.status], flexShrink: 0,
            }} />
            <span style={{ flex: 1, color: '#e5e7eb', fontSize: '0.82rem' }}>{p.address}</span>
            <StatusBadge status={p.status} />
            {p.id === closestId && <span style={{ color: '#facc15', fontSize: '0.78rem' }}>⭐</span>}
          </div>
        ))}
      </div>

      {selectedProp && (
        <div style={{
          marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: '#1f2937', border: '1px solid #374151',
          fontSize: '0.82rem', color: '#d1d5db',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedProp.address}</div>
          <div>Size: {selectedProp.size}</div>
          {selectedProp.available_date && <div>Available: {selectedProp.available_date}</div>}
        </div>
      )}
    </div>
  )
}

// ─── Main PropertyManager ─────────────────────────────────────────────────────

const PM_TABS = [
  { id: 'dashboard',  label: '🏠 Dashboard' },
  { id: 'properties', label: '🏢 Properties' },
  { id: 'agents',     label: '🧑‍💼 Agents' },
  { id: 'map_view',   label: '🗺 Map View' },
]

export default function PropertyManager({ userLocation }) {
  const [tab, setTab]               = useState('dashboard')
  const [properties, setProperties] = useState(DEMO_PROPERTIES)
  const [selectedPropertyId, setSelectedPropertyId] = useState(null)
  const [mapViewId, setMapViewId]   = useState(null)

  // Compute closest available property from the user's location (or map centre)
  const closestId = useMemo(() => {
    const refLat = userLocation?.lat ?? 51.505
    const refLng = userLocation?.lng ?? -0.09
    const available = properties.filter(p => p.status === 'empty' || p.status === 'soon_empty')
    if (!available.length) return null
    return available
      .map(p => ({ id: p.id, dist: _haversineKm(refLat, refLng, p.lat, p.lng) }))
      .sort((a, b) => a.dist - b.dist)[0].id
  }, [properties, userLocation])

  // Enrich properties with distance for tooltips
  const enriched = useMemo(() => {
    const refLat = userLocation?.lat ?? 51.505
    const refLng = userLocation?.lng ?? -0.09
    return properties.map(p => ({
      ...p,
      _dist: _haversineKm(refLat, refLng, p.lat, p.lng).toFixed(1),
      agent_name: DEMO_AGENTS.find(a => a.id === p.agent_id)?.name,
    }))
  }, [properties, userLocation])

  const handleShowOnMap = useCallback((prop) => {
    setMapViewId(prop.id)
    setTab('map_view')
  }, [])

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">🏢 Property Management</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Overview of properties, interactive map, and nearest agents.
        </p>
      </div>

      {/* Horizontal tab bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20, borderBottom: '1px solid #374151', paddingBottom: 10 }}>
        {PM_TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 16px', borderRadius: 8, fontSize: '0.82rem',
              fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              border: tab === t.id ? '2px solid #3b82f6' : '1px solid #374151',
              background: tab === t.id ? '#3b82f622' : '#1f2937',
              color: tab === t.id ? '#93c5fd' : '#9ca3af',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === 'dashboard' && (
        <DashboardPanel
          properties={enriched}
          agents={DEMO_AGENTS}
          userLocation={userLocation}
          onSelectProperty={p => setSelectedPropertyId(p.id)}
          closestId={closestId}
        />
      )}

      {tab === 'properties' && (
        <PropertiesPanel
          properties={properties}
          setProperties={setProperties}
          onSelectOnMap={handleShowOnMap}
        />
      )}

      {tab === 'agents' && (
        <AgentsPanel
          agents={DEMO_AGENTS}
          properties={properties}
          selectedPropertyId={selectedPropertyId}
        />
      )}

      {tab === 'map_view' && (
        <MapViewPanel
          properties={enriched}
          userLocation={userLocation}
          closestId={closestId}
          initialSelectedId={mapViewId}
        />
      )}
    </div>
  )
}
