import { useState, useEffect, useCallback } from 'react'
import { createRideRequest, listRideRequests, cancelRideRequest, acceptRideRequest } from '../api'
import socket from '../socket'

/**
 * RaiseRequest — Supply & Demand ride request feature.
 *
 * Passengers can raise a ride request when no matching ride is found.
 * Drivers can see open requests and accept them (which opens a DM chat).
 */
export default function RaiseRequest({ user, onConvCreated }) {
  const isDriver = user?.role === 'driver'

  // Request list
  const [requests,      setRequests]      = useState([])
  const [loading,       setLoading]       = useState(false)
  const [loadError,     setLoadError]     = useState('')

  // Post form
  const [showForm,      setShowForm]      = useState(false)
  const [formOrigin,    setFormOrigin]    = useState('')
  const [formDest,      setFormDest]      = useState('')
  const [formDate,      setFormDate]      = useState('')
  const [formPassengers, setFormPassengers] = useState(1)
  const [formPriceMin,  setFormPriceMin]  = useState('')
  const [formPriceMax,  setFormPriceMax]  = useState('')
  const [posting,       setPosting]       = useState(false)
  const [postError,     setPostError]     = useState('')
  const [postOk,        setPostOk]        = useState('')

  // Accept state
  const [accepting,     setAccepting]     = useState({})

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await listRideRequests('open')
      setRequests(data.requests || [])
    } catch (err) {
      setLoadError(err.message || 'Failed to load requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests])

  // Listen for new requests via socket
  useEffect(() => {
    const onNewRequest = (req) => {
      setRequests(prev => {
        if (prev.some(r => r.request_id === req.request_id)) return prev
        return [req, ...prev]
      })
    }
    socket.on('new_ride_request', onNewRequest)
    return () => socket.off('new_ride_request', onNewRequest)
  }, [])

  const handlePost = async (e) => {
    e.preventDefault()
    setPostError('')
    setPostOk('')
    if (!user) { setPostError('Please login first.'); return }
    setPosting(true)
    try {
      await createRideRequest(
        formOrigin.trim(), formDest.trim(), formDate,
        formPassengers,
        formPriceMin ? Number(formPriceMin) : null,
        formPriceMax ? Number(formPriceMax) : null,
      )
      setPostOk('✅ Request posted! Drivers can now see and accept it.')
      setFormOrigin(''); setFormDest(''); setFormDate('')
      setFormPassengers(1); setFormPriceMin(''); setFormPriceMax('')
      setShowForm(false)
      await loadRequests()
    } catch (err) {
      setPostError(err.message || 'Failed to post request.')
    } finally {
      setPosting(false)
    }
  }

  const handleCancel = async (requestId) => {
    if (!window.confirm('Cancel this ride request?')) return
    try {
      await cancelRideRequest(requestId)
      setRequests(prev => prev.filter(r => r.request_id !== requestId))
    } catch (err) {
      alert(err.message || 'Failed to cancel request.')
    }
  }

  const handleAccept = async (requestId) => {
    setAccepting(prev => ({ ...prev, [requestId]: true }))
    try {
      const data = await acceptRideRequest(requestId)
      setRequests(prev => prev.filter(r => r.request_id !== requestId))
      if (data.conv_id) {
        onConvCreated?.(data.conv_id)
      }
    } catch (err) {
      alert(err.message || 'Failed to accept request.')
    } finally {
      setAccepting(prev => ({ ...prev, [requestId]: false }))
    }
  }

  const inputCls = 'rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full'
  const inputStyle = { background: 'var(--bg-surface, #1f2937)', color: 'var(--text-primary, #f3f4f6)', border: '1px solid var(--border-color, #374151)' }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-200 flex items-center gap-2">
            🙋 Ride Requests
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {isDriver
              ? 'Passengers looking for rides — accept to start a chat.'
              : "Can't find a ride? Raise a request for drivers to see."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadRequests} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">↺</button>
          {user && !isDriver && (
            <button
              onClick={() => { setShowForm(v => !v); setPostError(''); setPostOk('') }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                showForm
                  ? 'bg-amber-700 border-amber-600 text-white'
                  : 'border-gray-600 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {showForm ? '✕ Cancel' : '+ Raise Request'}
            </button>
          )}
        </div>
      </div>

      {/* Post form (passengers only) */}
      {showForm && !isDriver && (
        <form onSubmit={handlePost} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)', boxShadow: '0 4px 24px rgba(0,0,0,0.15)' }}>
          {/* Form header */}
          <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #f59e0b20, #d9770620)', borderBottom: '1px solid var(--border-color)' }}>
            <span className="text-amber-400">🙋</span>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Request a Ride</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Drivers will see your request</p>
            </div>
          </div>
          <div className="p-4 space-y-3" style={{ background: 'var(--bg-card)' }}>
            {/* Route */}
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-400 text-xs pointer-events-none">📍</span>
                <input type="text" placeholder="Pickup — e.g. Manchester Airport" value={formOrigin}
                  onChange={e => setFormOrigin(e.target.value)} required
                  className={inputCls} style={{ ...inputStyle, paddingLeft: '2rem' }} />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-400 text-xs pointer-events-none">🏁</span>
                <input type="text" placeholder="Destination — e.g. Liverpool Centre" value={formDest}
                  onChange={e => setFormDest(e.target.value)} required
                  className={inputCls} style={{ ...inputStyle, paddingLeft: '2rem' }} />
              </div>
            </div>
            {/* Date + Passengers */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>📅 Date &amp; Time *</label>
                <input type="datetime-local" value={formDate} onChange={e => setFormDate(e.target.value)}
                  required className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>👥 Passengers</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setFormPassengers(p => Math.max(1, p - 1))}
                    className="w-8 h-8 rounded-lg font-bold flex items-center justify-center"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>−</button>
                  <span className="flex-1 text-center font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{formPassengers}</span>
                  <button type="button" onClick={() => setFormPassengers(p => Math.min(20, p + 1))}
                    className="w-8 h-8 rounded-lg font-bold flex items-center justify-center"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>+</button>
                </div>
              </div>
            </div>
            {/* Price range */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>💰 Price Range (optional)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>$</span>
                  <input type="number" min={0} placeholder="Min" value={formPriceMin}
                    onChange={e => setFormPriceMin(e.target.value)}
                    className={inputCls} style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
                </div>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>$</span>
                  <input type="number" min={0} placeholder="Max" value={formPriceMax}
                    onChange={e => setFormPriceMax(e.target.value)}
                    className={inputCls} style={{ ...inputStyle, paddingLeft: '1.5rem' }} />
                </div>
              </div>
            </div>
            {postError && <p className="text-red-400 text-xs">{postError}</p>}
            {postOk    && <p className="text-green-400 text-xs">{postOk}</p>}
            <button type="submit" disabled={posting}
              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors bg-amber-500 hover:bg-amber-400 text-black">
              {posting ? '⏳ Posting…' : '🙋 Raise Ride Request'}
            </button>
          </div>
        </form>
      )}

      {/* Request list */}
      {loading && (
        <div className="flex justify-center py-6"><div className="spinner w-6 h-6" /></div>
      )}
      {loadError && <p className="text-red-400 text-xs">{loadError}</p>}

      {!loading && requests.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p className="text-2xl mb-1">🙋</p>
          <p>{isDriver ? 'No open ride requests at the moment.' : 'No requests yet.'}</p>
        </div>
      )}

      <div className="space-y-2">
        {requests.map(req => (
          <div key={req.request_id}
            className="rounded-xl p-3 space-y-1.5 transition-all hover:opacity-90"
            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>📍 {req.origin}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                  <span className="font-semibold text-sm text-amber-400">{req.destination}</span>
                </div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                    🕐 {new Date(req.desired_date).toLocaleString()}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                    👥 {req.passengers} pax
                  </span>
                  {(req.price_min != null || req.price_max != null) && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                      💰 {req.price_min != null ? `$${req.price_min}` : ''}{req.price_min != null && req.price_max != null ? '–' : ''}{req.price_max != null ? `$${req.price_max}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>👤 {req.passenger_name}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {isDriver && (
                  <button
                    onClick={() => handleAccept(req.request_id)}
                    disabled={accepting[req.request_id]}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>
                    {accepting[req.request_id] ? '…' : '✅ Accept'}
                  </button>
                )}
                {user && user.user_id === req.user_id && !isDriver && (
                  <button
                    onClick={() => handleCancel(req.request_id)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/40 border border-red-800/50 text-red-400 transition-colors">
                    🗑 Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
