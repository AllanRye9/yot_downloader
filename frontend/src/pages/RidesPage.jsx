import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import RideShare from '../components/RideShare'
import RideShareMap from '../components/RideShareMap'
import ThemeSelector from '../components/ThemeSelector'
import UserAuth from '../components/UserAuth'
import UserProfile from '../components/UserProfile'
import { getUserProfile } from '../api'

export default function RidesPage() {
  const { admin } = useAuth()
  const [appUser, setAppUser]         = useState(null)   // null=loading, false=not logged in, object=logged in
  const [userLoading, setUserLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [rides, setRides]             = useState([])
  // State for opening chat from the map with a pre-filled default message
  const [mapChatRequest, setMapChatRequest] = useState(null) // { ride, defaultMsg }
  const profileRef = useRef(null)

  // Load platform user session
  useEffect(() => {
    getUserProfile()
      .then(u => setAppUser(u))
      .catch(() => setAppUser(false))
      .finally(() => setUserLoading(false))
  }, [])

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openRides = rides.filter(r => r.status === 'open')

  return (
    <div style={{ minHeight: '100vh', background: '#030712', display: 'flex', flexDirection: 'column' }}>
      {/* Auth modal */}
      {showAuthModal && !appUser && (
        <UserAuth
          onSuccess={(u) => { setAppUser(u); setShowAuthModal(false) }}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-full px-4 flex items-center h-14 gap-4">
          {/* Back to home */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-white shrink-0"
          >
            <img src="/yotweek.png" alt="" width={22} height={22} style={{ borderRadius: 4 }} aria-hidden="true" />
            <span className="gradient-text hidden sm:inline">yotweek</span>
            <span className="gradient-text sm:hidden">YOT</span>
          </Link>

          <Link
            to="/"
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            ← Home
          </Link>

          <div className="flex-1" />

          <ThemeSelector />

          {/* User profile avatar */}
          {!userLoading && (
            <div className="relative" ref={profileRef}>
              {appUser ? (
                <>
                  {/* Compact avatar button — shows name on larger screens */}
                  <button
                    onClick={() => setProfileOpen(o => !o)}
                    className="nav-profile-btn flex items-center gap-2 rounded-full bg-blue-700 hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 pl-1 pr-3 py-1"
                    aria-label="Profile"
                    title={appUser.name}
                  >
                    {appUser.avatar_url ? (
                      <img src={appUser.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-blue-800 flex items-center justify-center text-sm shrink-0">
                        {appUser.role === 'driver' ? '🚗' : '🧍'}
                      </span>
                    )}
                    <span className="hidden sm:block text-white text-xs font-medium max-w-[100px] truncate">{appUser.name}</span>
                    <span className="hidden sm:block text-blue-300 text-xs">▾</span>
                  </button>
                  {profileOpen && (
                    <div className="nav-profile-dropdown absolute right-0 top-11 w-72 sm:w-80 lg:w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-[85vh] overflow-y-auto">
                      <UserProfile
                        user={appUser}
                        onLogout={() => { setAppUser(false); setProfileOpen(false) }}
                        onLocationUpdate={() => {}}
                        onUserUpdate={(u) => setAppUser(u)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors"
                >
                  Login / Register
                </button>
              )}
            </div>
          )}

          {admin && (
            <Link to="/const" className="btn-secondary btn-sm hidden sm:inline-flex">
              Dashboard
            </Link>
          )}
        </div>
      </nav>

      {/* ── Page header ── */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#f3f4f6', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>🚗 Ride Share &amp; Driver Alerts</h1>
          <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: '2px 0 0' }}>
            Post shared rides, find passengers, and receive real-time driver alerts.
          </p>
        </div>
      </div>

      {/* ── Main content ── */}
      {userLoading ? (
        <div className="flex justify-center py-16">
          <div className="spinner w-10 h-10" />
        </div>
      ) : !appUser ? (
        /* ── Auth gate ── */
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center flex-1">
          <div className="text-5xl">🔒</div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-gray-400 text-sm max-w-xs">
              Please login or create a free account to view rides, post a ride, and receive driver alerts.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
            >
              Login / Register
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-sm transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      ) : (
        /* ── 3-column authenticated layout ── */
        <div style={{ flex: 1, display: 'flex', height: 'calc(100vh - 110px)', minHeight: 0 }}>

          {/* ── Left: Available Rides ── */}
          <aside style={{
            width: 280, flexShrink: 0,
            borderRight: '1px solid #1f2937',
            overflowY: 'auto',
            background: '#111827',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1f2937' }}>
              <div style={{ color: '#d1d5db', fontSize: '0.85rem', fontWeight: 700 }}>🚗 Available Rides</div>
              <div style={{ color: '#6b7280', fontSize: '0.72rem', marginTop: 2 }}>{openRides.length} open ride{openRides.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {openRides.length === 0 ? (
                <div style={{ color: '#4b5563', textAlign: 'center', padding: '24px 8px', fontSize: '0.82rem' }}>
                  No open rides yet. Post one!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {openRides.map(ride => (
                    <div key={ride.ride_id} style={{
                      background: '#1f2937', border: '1px solid #374151', borderRadius: 10,
                      padding: '10px 12px',
                    }}>
                      <div style={{ color: '#f3f4f6', fontSize: '0.82rem', fontWeight: 600, marginBottom: 2 }}>
                        {ride.origin} → {ride.destination}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: '0.72rem', marginBottom: 4 }}>
                        🕐 {ride.departure ? new Date(ride.departure).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: '#86efac', fontSize: '0.72rem' }}>💺 {ride.seats} seat{ride.seats !== 1 ? 's' : ''}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.72rem' }}>👤 {ride.driver_name ?? ride.user_name ?? 'Driver'}</span>
                      </div>
                      {ride.notes && (
                        <div style={{ color: '#6b7280', fontSize: '0.7rem', marginTop: 4, fontStyle: 'italic' }}>
                          {ride.notes.length > 60 ? ride.notes.slice(0, 60) + '…' : ride.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* ── Center: Map ── */}
          <main style={{ flex: 1, minWidth: 0, height: '100%', background: '#030712', display: 'flex', flexDirection: 'column' }}>
            <RideShareMap
              rides={rides}
              userLocation={appUser?.lat != null ? { lat: appUser.lat, lng: appUser.lng } : null}
              onOpenChat={(ride, defaultMsg) => setMapChatRequest({ ride, defaultMsg })}
              mapHeight="100%"
            />
          </main>

          {/* ── Right: Ride Dashboard ── */}
          <aside style={{
            width: 340, flexShrink: 0,
            borderLeft: '1px solid #1f2937',
            overflowY: 'auto',
            background: '#111827',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #1f2937' }}>
              <div style={{ color: '#d1d5db', fontSize: '0.85rem', fontWeight: 700 }}>📊 Ride Dashboard</div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
              <RideShare
                user={appUser}
                onRidesChange={setRides}
                requestedRide={mapChatRequest}
                onRequestedRideHandled={() => setMapChatRequest(null)}
              />
            </div>
          </aside>

        </div>
      )}

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 py-4 px-4 text-center text-xs text-gray-600">
        <p>yotweek © {new Date().getFullYear()} — <Link to="/" className="hover:text-gray-400">Back to Home</Link></p>
      </footer>
    </div>
  )
}
