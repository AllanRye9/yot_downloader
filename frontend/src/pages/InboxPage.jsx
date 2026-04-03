import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import socket from '../socket'
import {
  dmListConversations, dmStartConversation, dmGetContacts, dmDeleteConversation,
  searchUsers, listRides, takeRide, getUserProfile, updateUserLocation,
} from '../api'
import DMChat from '../components/DMChat'
import { playMessageChime } from '../sounds'

// ─── Constants ────────────────────────────────────────────────────────────────

const CLICK_ANIM_MS = 200
const POLL_MS       = 3000   // chat background poll interval

// ─── Compact Ride Share Strip ─────────────────────────────────────────────────

function RideShareStrip() {
  const [rides,   setRides]   = useState([])
  const [loading, setLoading] = useState(true)
  const [taking,  setTaking]  = useState(null) // rideId being requested

  useEffect(() => {
    listRides('open')
      .then(d => setRides((d.rides || []).slice(0, 20)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleRequest = async (rideId) => {
    setTaking(rideId)
    try { await takeRide(rideId) } catch { /* ignore */ } finally { setTaking(null) }
  }

  const fmtDep = (dep) => {
    if (!dep) return ''
    try {
      return new Date(dep).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return dep }
  }

  return (
    <div
      className="px-[4%] py-2 border-b border-gray-800 bg-gray-900/80"
      style={{ minHeight: 40, maxHeight: 132 }}
    >
      <p className="text-[0.8rem] font-semibold text-amber-400 mb-1.5 flex items-center gap-1">
        🚗 Ride Share
      </p>
      {loading ? (
        <p className="text-xs text-gray-500">Loading rides…</p>
      ) : rides.length === 0 ? (
        <p className="text-xs text-gray-500">No open rides at the moment.</p>
      ) : (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {rides.map(ride => (
            <div
              key={ride.ride_id}
              className="shrink-0 rounded-xl bg-gray-800 border border-gray-700 px-3 py-2 flex flex-col justify-between"
              style={{ width: 140, minHeight: 90 }}
            >
              <div>
                <p className="text-xs font-semibold text-white truncate">{ride.driver_name || 'Driver'}</p>
                <p className="text-[0.7rem] text-amber-300 truncate">→ {ride.destination}</p>
                <p className="text-[0.65rem] text-gray-400 truncate">{fmtDep(ride.departure)}</p>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[0.65rem] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full">
                  {ride.seats} seat{ride.seats !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => handleRequest(ride.ride_id)}
                  disabled={taking === ride.ride_id}
                  className="text-[0.65rem] px-2 py-0.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                  style={{ height: 24 }}
                >
                  {taking === ride.ride_id ? '…' : 'Request'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Broadcast Location Bar ───────────────────────────────────────────────────

function BroadcastLocationBar() {
  const [sharing,     setSharing]     = useState(false)
  const [locationTxt, setLocationTxt] = useState('')
  const [error,       setError]       = useState('')
  const intervalRef = useRef(null)

  const stopSharing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setSharing(false)
  }, [])

  useEffect(() => () => stopSharing(), [stopSharing])

  const broadcastOnce = () =>
    new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords
          try {
            await updateUserLocation(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
            setLocationTxt(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
            resolve()
          } catch (e) { reject(e) }
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      )
    })

  const handleShare = async () => {
    setError('')
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return }
    try {
      await broadcastOnce()
      setSharing(true)
      intervalRef.current = setInterval(() => { broadcastOnce().catch(() => {}) }, 15_000)
    } catch {
      setError('Could not get location.')
    }
  }

  return (
    <div
      className="px-[4%] border-b border-gray-800 bg-gray-900/60 flex items-center gap-2"
      style={{ height: 48, minHeight: 48, maxHeight: 48 }}
    >
      <p className="text-[0.75rem] font-semibold text-gray-400 uppercase tracking-wide shrink-0">
        📍 Broadcast Location
      </p>
      {sharing && (
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 animate-pulse" title="Broadcasting" />
      )}
      <p className="text-[0.78rem] text-gray-500 truncate flex-1 min-w-0">
        {sharing ? locationTxt || 'Sharing…' : (error || 'Not broadcasting')}
      </p>
      {sharing ? (
        <button
          onClick={stopSharing}
          className="shrink-0 text-[0.7rem] px-2 py-0.5 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          style={{ height: 28 }}
        >
          Stop sharing
        </button>
      ) : (
        <button
          onClick={handleShare}
          className="shrink-0 text-[0.7rem] px-2 py-0.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white transition-colors"
          style={{ height: 28 }}
        >
          Share
        </button>
      )}
    </div>
  )
}

// ─── Main InboxPage ───────────────────────────────────────────────────────────

export default function InboxPage() {
  const navigate = useNavigate()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    getUserProfile()
      .then(u => { setCurrentUser(u); setAuthChecked(true) })
      .catch(() => { setAuthChecked(true); navigate('/', { replace: true }) })
  }, [navigate])

  // ── Conversations state ───────────────────────────────────────────────────
  const [conversations,  setConversations]  = useState([])
  const [loading,        setLoading]        = useState(true)
  const [activeConv,     setActiveConv]     = useState(null)
  const [filter,         setFilter]         = useState('all')  // 'all' | 'unread' | 'sent'
  const [convSearch,     setConvSearch]     = useState('')
  const [totalUnread,    setTotalUnread]    = useState(0)
  const [clickedConv,    setClickedConv]    = useState(null)

  // New chat state
  const [showNewChat,   setShowNewChat]   = useState(false)
  const [contacts,      setContacts]      = useState([])
  const [userSearch,    setUserSearch]    = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimerRef = useRef(null)
  const prevUnreadRef  = useRef(0)
  const pollTimerRef   = useRef(null)

  const myId = currentUser?.user_id

  // ── Load conversations ────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const data = await dmListConversations()
      const convs = data.conversations || []
      setConversations(convs)
      const newTotal = convs.reduce((s, c) => s + (c.unread_count || 0), 0)
      if (newTotal > prevUnreadRef.current) playMessageChime()
      prevUnreadRef.current = newTotal
      setTotalUnread(newTotal)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!myId) return
    loadConversations()
  }, [myId, loadConversations])

  // ── Background poll while a chat is open ─────────────────────────────────

  useEffect(() => {
    if (!myId) return
    if (activeConv) {
      // Poll conversations list for unread updates in background
      pollTimerRef.current = setInterval(loadConversations, POLL_MS)
    }
    return () => { clearInterval(pollTimerRef.current) }
  }, [myId, activeConv, loadConversations])

  // ── Real-time socket ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!myId) return
    const onNotif = () => loadConversations()
    socket.on('dm_notification', onNotif)
    return () => socket.off('dm_notification', onNotif)
  }, [myId, loadConversations])

  // ── New chat ──────────────────────────────────────────────────────────────

  const handleOpenNewChat = async () => {
    setShowNewChat(true)
    setUserSearch('')
    setSearchResults([])
    if (contacts.length === 0) {
      try {
        const data = await dmGetContacts()
        setContacts(data.contacts || [])
      } catch { /* ignore */ }
    }
  }

  const handleUserSearchChange = (val) => {
    setUserSearch(val)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!val.trim()) { setSearchResults([]); return }
    setSearchLoading(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const data = await searchUsers(val.trim())
        setSearchResults(data.users || [])
      } catch { /* ignore */ } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  const handleStartConversation = async (otherUserId) => {
    try {
      const data = await dmStartConversation(otherUserId)
      const conv = data.conv
      const userMap = new Map([
        ...conversations.map(c => c.other_user ? [c.other_user.user_id, c.other_user] : null).filter(Boolean),
        ...contacts.map(u => [u.user_id, u]),
      ])
      const otherUser = userMap.get(otherUserId)
      setActiveConv({
        conv_id:    conv.conv_id,
        other_user: { user_id: otherUserId, name: otherUser?.name || otherUserId },
        unread_count: 0,
        last_message: null,
      })
      setShowNewChat(false)
      loadConversations()
    } catch { /* ignore */ }
  }

  // ── Delete conversation ───────────────────────────────────────────────────

  const handleDelete = async (convId) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return
    try {
      await dmDeleteConversation(convId)
      setConversations(prev => prev.filter(c => c.conv_id !== convId))
      if (activeConv?.conv_id === convId) setActiveConv(null)
    } catch { /* ignore */ }
  }

  // ── Format time ───────────────────────────────────────────────────────────

  const fmtTime = (ts) => {
    if (!ts) return ''
    const d  = ts > 1e10 ? new Date(ts) : new Date(ts * 1000)
    const now = new Date()
    const diff = now - d
    if (diff < 60_000)           return 'just now'
    if (diff < 3_600_000)        return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000)       return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // ── Filter logic ──────────────────────────────────────────────────────────

  const filteredConversations = conversations.filter(c => {
    if (convSearch.trim() && !c.other_user?.name?.toLowerCase().includes(convSearch.toLowerCase())) return false
    if (filter === 'unread') return (c.unread_count || 0) > 0
    if (filter === 'sent')   return c.last_message?.sender_id === myId
    return true
  })

  // ── New-chat user list ────────────────────────────────────────────────────

  const filteredUsers = userSearch.trim()
    ? searchResults
    : contacts.filter(u => u.name.toLowerCase().includes(userSearch.toLowerCase()))

  // ── Loading / auth guards ─────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="spinner w-10 h-10" />
      </div>
    )
  }
  if (!currentUser) return null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* ── Page header ── */}
      <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800">
        <div className="px-[4%] flex items-center h-12 gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm shrink-0"
            style={{ height: 32, padding: '0 12px' }}
            aria-label="Back to Dashboard"
          >
            ← <span className="hidden sm:inline">Back to Dashboard</span>
          </button>
          <div className="w-px h-5 bg-gray-700 shrink-0" />
          <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
            💬 Messages
            {totalUnread > 0 && (
              <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </h1>
        </div>
      </header>

      {/* ── Ride Share compact strip ── */}
      <RideShareStrip />

      {/* ── Broadcast Location bar ── */}
      <BroadcastLocationBar />

      {/* ── Two-panel inbox area (fills remaining height) ── */}
      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── Left column: Thread list ── */}
        <div
          className={`flex flex-col border-r border-gray-700 bg-gray-900/80 overflow-hidden
            ${activeConv ? 'hidden md:flex' : 'flex'}
            w-full md:w-[32%] md:min-w-[220px] md:max-w-[320px]`}
        >
          {/* Left header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
            <p className="text-xs font-bold text-white">Inbox</p>
            <div className="flex gap-1.5 items-center">
              <button
                onClick={loadConversations}
                className="text-xs text-gray-500 hover:text-gray-200 transition-colors"
                title="Refresh"
                aria-label="Refresh conversations"
              >
                ↺
              </button>
              <button
                onClick={handleOpenNewChat}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded-lg transition-colors"
              >
                + New
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-gray-700/50 shrink-0">
            <input
              type="text"
              placeholder="Search messages…"
              value={convSearch}
              onChange={e => setConvSearch(e.target.value)}
              className="w-full rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
              style={{ height: 32 }}
            />
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-gray-700/50 shrink-0">
            {[
              { id: 'all',    label: 'All' },
              { id: 'unread', label: 'Unread' },
              { id: 'sent',   label: 'Sent' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex-1 text-xs py-1.5 transition-colors border-b-2 ${
                  filter === tab.id
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* New chat picker */}
          {showNewChat && (
            <div className="mx-2 my-1.5 bg-gray-800 border border-gray-700 rounded-xl p-3 space-y-2 shrink-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Start a conversation</p>
                <button
                  onClick={() => { setShowNewChat(false); setUserSearch(''); setSearchResults([]) }}
                  className="text-gray-500 hover:text-gray-300 text-base leading-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search username…"
                  value={userSearch}
                  onChange={e => handleUserSearchChange(e.target.value)}
                  autoFocus
                  className="w-full rounded-lg bg-gray-900 border border-gray-600 text-gray-100 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchLoading && (
                  <span className="absolute right-2 top-1.5 text-gray-400 text-xs">⏳</span>
                )}
              </div>
              {filteredUsers.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-1">
                  {userSearch.trim()
                    ? (searchLoading ? 'Searching…' : 'No users found.')
                    : (contacts.length === 0 ? 'Type a username to search.' : 'No contacts match.')}
                </p>
              ) : (
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {filteredUsers.map(u => (
                    <button
                      key={u.user_id}
                      onClick={() => handleStartConversation(u.user_id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-700 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-white block truncate">{u.name}</span>
                        {u.username && u.username !== u.name && (
                          <span className="text-xs text-gray-400 block truncate">@{u.username}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Thread list — scrollable */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="spinner w-5 h-5" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center text-xs text-gray-500 py-8 px-3">
                <p className="text-2xl mb-1">💬</p>
                <p>{convSearch || filter !== 'all' ? 'No matches.' : 'No conversations yet.'}</p>
                {!convSearch && filter === 'all' && (
                  <button
                    onClick={handleOpenNewChat}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Start one →
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isActive  = activeConv?.conv_id === conv.conv_id
                const lastMsg   = conv.last_message
                const isSentByMe = lastMsg?.sender_id === myId
                const isInbox   = lastMsg && !isSentByMe
                const lastTs    = lastMsg?.ts
                const preview   = lastMsg ? (lastMsg.content || '…') : 'No messages yet'

                return (
                  <div
                    key={conv.conv_id}
                    className={`border-b border-gray-800/60 transition-colors ${
                      isActive ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/50'
                    }`}
                    style={{
                      transform: clickedConv === conv.conv_id ? 'scale(0.98)' : '',
                      transition: `transform ${CLICK_ANIM_MS}ms ease`,
                    }}
                  >
                    <div
                      className="flex items-center gap-2 px-3 cursor-pointer"
                      style={{ paddingTop: 8, paddingBottom: 8 }}
                      onClick={() => {
                        setClickedConv(conv.conv_id)
                        setTimeout(() => { setClickedConv(null); setActiveConv(conv) }, CLICK_ANIM_MS)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && setActiveConv(conv)}
                      aria-label={`Open chat with ${conv.other_user?.name || 'User'}`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white">
                          {conv.other_user?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        {conv.unread_count > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 border border-gray-900 flex items-center justify-center text-white text-[9px] font-bold">
                            {conv.unread_count > 9 ? '9+' : conv.unread_count}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {/* INBOX / OUTBOX tag */}
                          {isInbox && (
                            <span className="text-[0.6rem] px-1 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-800/50 font-semibold shrink-0">
                              INBOX
                            </span>
                          )}
                          {isSentByMe && (
                            <span className="text-[0.6rem] px-1 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800/50 font-semibold shrink-0">
                              OUTBOX
                            </span>
                          )}
                          <p className={`text-xs truncate ${conv.unread_count > 0 ? 'font-bold text-white' : 'font-semibold text-gray-200'}`}>
                            {isSentByMe ? (
                              <><span className="text-gray-500 font-normal">To: </span>{conv.other_user?.name || 'User'}</>
                            ) : (
                              conv.other_user?.name || 'User'
                            )}
                          </p>
                          <span className="text-xs text-gray-600 shrink-0 ml-auto">{fmtTime(lastTs)}</span>
                        </div>
                        <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-gray-200' : 'text-gray-500'}`}>
                          {preview.slice(0, 55)}{preview.length > 55 ? '…' : ''}
                        </p>
                      </div>

                      {/* Delete action */}
                      <div className="shrink-0 ml-1" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(conv.conv_id)}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors p-1 rounded"
                          title="Delete"
                          aria-label="Delete conversation"
                          style={{ minWidth: 32, minHeight: 32 }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right column: Chat ── */}
        <div className={`flex-1 flex flex-col overflow-hidden ${!activeConv ? 'hidden md:flex' : 'flex'}`}>
          {activeConv ? (
            <DMChat
              conv={activeConv}
              currentUser={currentUser}
              onClose={() => { setActiveConv(null); loadConversations() }}
              onBack={() => setActiveConv(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-6">
              <p className="text-5xl opacity-40">💬</p>
              <p className="text-sm text-gray-400">Select a conversation to start chatting</p>
              <button
                onClick={handleOpenNewChat}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                + New Message
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
