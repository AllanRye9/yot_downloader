/**
 * Centralized API client for YotWeek ride-sharing platform.
 * All requests go to the same origin (served by FastAPI).
 */

const BASE = ''  // same origin

async function request(method, path, body = null, isJSON = true) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  }
  if (body !== null) {
    if (isJSON) {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    } else {
      // FormData — let browser set Content-Type with boundary
      opts.body = body
    }
  }
  const res = await fetch(BASE + path, opts)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const data = await res.json()
    if (!res.ok) throw Object.assign(new Error(data.error || data.detail || 'Request failed'), { status: res.status, data })
    return data
  }
  if (!res.ok) throw Object.assign(new Error('Request failed'), { status: res.status })
  return res
}

function formBody(obj) {
  const fd = new FormData()
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v) })
  return fd
}

// ── Core ──────────────────────────────────────────────────────────────────────

export const getHealth = () => request('GET', '/health')
export const getPlatformStats = () => request('GET', '/api/platform_stats')

// ── Admin Auth ────────────────────────────────────────────────────────────────

export const getAdminAuthStatus = () => request('GET', '/admin/auth_status')
export const adminLogin         = (username, password) =>
  request('POST', '/admin/api/login', { username, password })
export const adminLogout        = () => request('POST', '/admin/api/logout', {})
export const adminRegister      = (username, password, confirmPassword) =>
  request('POST', '/admin/api/register', { username, password, confirm_password: confirmPassword })
export const checkAdminExists   = () => request('GET', '/admin/has_admin')

// ── Admin DB ──────────────────────────────────────────────────────────────────

export const adminDbDownloadUrl = () => `${BASE}/admin/db/download`
export const adminDbUpload      = (file) => {
  const fd = new FormData()
  fd.append('db_file', file)
  return request('POST', '/admin/db/upload', fd, false)
}

// ── User Auth ─────────────────────────────────────────────────────────────────

export const userRegister = (name, email, password, role = 'passenger', phone = '') =>
  request('POST', '/api/auth/register', { name, email, password, role, phone })

export const userLogin = (email, password, remember_me = false) =>
  request('POST', '/api/auth/login', { email, password, remember_me })

export const userLogout = () => request('POST', '/api/auth/logout', {})

export const getUserProfile = () => request('GET', '/api/auth/me')

export const updateUserLocation = (lat, lng, location_name = '') =>
  request('POST', '/api/auth/location', { lat, lng, location_name })

export const updateProfileDetails = (name, bio, phone = '', home_city = '', preferred_language = '') =>
  request('PUT', '/api/auth/profile/details', { name, bio, phone, location_name: home_city, preferred_language })

export const changePassword = (current_password, new_password) =>
  request('POST', '/api/auth/change_password', { current_password, new_password })

export const uploadAvatar = (file) => {
  const fd = new FormData()
  fd.append('file', file, file.name)
  return request('POST', '/api/auth/avatar', fd, false)
}

export const deleteAvatar = () =>
  request('DELETE', '/api/auth/avatar')

export const forgotPassword = (email) =>
  request('POST', '/api/auth/forgot_password', { email })

export const resetPassword = (token, new_password) =>
  request('POST', '/api/auth/reset_password', { token, new_password })

export const requestMagicLink = (email) =>
  request('POST', '/api/auth/magic_link', { email })

export const verifyMagicLink = (token) =>
  request('GET', `/api/auth/magic_link?token=${encodeURIComponent(token)}`)

export const verifyEmail = (token) =>
  request('GET', `/api/auth/verify_email?token=${encodeURIComponent(token)}`)

// ── Notifications ─────────────────────────────────────────────────────────────

export const getNotifications = () => request('GET', '/api/notifications')

export const markNotificationRead = (notifId) =>
  request('POST', `/api/notifications/${encodeURIComponent(notifId)}/read`, {})

export const markAllNotificationsRead = () =>
  request('POST', '/api/notifications/read_all', {})

export const clearAllNotifications = () =>
  request('DELETE', '/api/notifications/clear_all')

// ── Driver ────────────────────────────────────────────────────────────────────

export const driverApply = (vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate, plate_number = '') =>
  request('POST', '/api/auth/driver_apply', { vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate, plate_number })

export const getDriverApplication = () => request('GET', '/api/auth/driver_application')

export const getAdminDriverApplications = () => request('GET', '/api/admin/driver_applications')

export const approveDriverApplication = (appId, approved) =>
  request('POST', `/api/admin/driver_applications/${encodeURIComponent(appId)}/approve`, { approved })

export const getDriverDashboard = () => request('GET', '/api/driver/dashboard')

export const updateDriverLocation = (lat, lng, empty = true, seats = 0) =>
  request('POST', '/api/driver/location', { lat, lng, empty, seats })

export const getNearbyDrivers = (lat, lng, radius_km = 10) =>
  request('GET', `/api/driver/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}`)

export const getAllDriverLocations = () => request('GET', '/api/driver/locations')

// ── Ride History ──────────────────────────────────────────────────────────────

export const getRideHistory = () => request('GET', '/api/rides/history')

// ── Ride Booking ──────────────────────────────────────────────────────────────

export const postRide = (origin, destination, departure, seats, notes = '', origin_lat = null, origin_lng = null, dest_lat = null, dest_lng = null, fare = null, ride_type = '', vehicle_color = '', vehicle_type = '', plate_number = '') =>
  request('POST', '/api/rides', { origin, destination, departure, seats, notes, origin_lat, origin_lng, dest_lat, dest_lng, fare, ride_type, vehicle_color, vehicle_type, plate_number })

export const calculateFare = (origin_lat, origin_lng, dest_lat, dest_lng) =>
  request('GET', `/api/rides/fare?origin_lat=${origin_lat}&origin_lng=${origin_lng}&dest_lat=${dest_lat}&dest_lng=${dest_lng}`)

export const calculateSharedFare = (total_fare, total_seats, booked_seats) =>
  request('GET', `/api/rides/shared_fare?total_fare=${total_fare}&total_seats=${total_seats}&booked_seats=${booked_seats}`)

export const geocodeAddress = (address) =>
  request('GET', `/api/geocode?address=${encodeURIComponent(address)}`)

export const estimateFare = (start, destination, seats = 1) =>
  request('GET', `/api/fare_estimate?start=${encodeURIComponent(start)}&destination=${encodeURIComponent(destination)}&seats=${seats}`)

export const listRides = (status = null) =>
  request('GET', `/api/rides${status ? `?status=${encodeURIComponent(status)}` : ''}`)

export const getRide = (rideId) =>
  request('GET', `/api/rides/${encodeURIComponent(rideId)}`)

export const cancelRide = (rideId) => request('DELETE', `/api/rides/${encodeURIComponent(rideId)}`)

export const takeRide = (rideId) => request('POST', `/api/rides/${encodeURIComponent(rideId)}/take`)

export const alertRideClients = (rideId) => request('POST', `/api/rides/${encodeURIComponent(rideId)}/alert`)

export const confirmJourney = (rideId, real_name, contact) =>
  request('POST', `/api/rides/${encodeURIComponent(rideId)}/confirm_journey`, { real_name, contact })

export const getConfirmedUsers = (rideId) =>
  request('GET', `/api/rides/${encodeURIComponent(rideId)}/confirmed_users`)

export const proximityNotify = (rideId, distance_km, unit = 'km') =>
  request('POST', `/api/rides/${encodeURIComponent(rideId)}/proximity_notify`, { distance_km, unit })

export const getAdminRides = () => request('GET', '/api/admin/rides')

// ── Ride Requests ─────────────────────────────────────────────────────────────

export const createRideRequest = (origin, destination, desired_date, passengers = 1, notes = '') =>
  request('POST', '/api/ride_requests', { origin, destination, desired_date, passengers, notes })

export const listRideRequests = (status = 'open') =>
  request('GET', `/api/ride_requests?status=${encodeURIComponent(status)}`)

export const getRideRequests = (status = 'open') => listRideRequests(status)

export const acceptRideRequest = (requestId) =>
  request('POST', `/api/ride_requests/${encodeURIComponent(requestId)}/accept`)

export const cancelRideRequest = (requestId) =>
  request('POST', `/api/ride_requests/${encodeURIComponent(requestId)}/cancel`)

// ── Travel Companions ─────────────────────────────────────────────────────────

export const createTravelCompanion = (origin_country, destination_country, travel_date, preferences = '') =>
  request('POST', '/api/travel_companions', { origin_country, destination_country, travel_date, preferences })

export const listTravelCompanions = (origin_country = null, destination_country = null, travel_date = null) => {
  const qs = new URLSearchParams()
  if (origin_country)      qs.set('origin_country',      origin_country)
  if (destination_country) qs.set('destination_country', destination_country)
  if (travel_date)         qs.set('travel_date',         travel_date)
  const query = qs.toString()
  return request('GET', `/api/travel_companions${query ? '?' + query : ''}`)
}

export const deleteTravelCompanion = (companionId) =>
  request('DELETE', `/api/travel_companions/${encodeURIComponent(companionId)}`)

// ── Ride Chat ─────────────────────────────────────────────────────────────────

export const getRideChatMessages = (rideId) =>
  request('GET', `/api/rides/${encodeURIComponent(rideId)}/chat`)

export const getRideChatInbox = () => request('GET', '/api/rides/chat/inbox')

// ── Unified Map ───────────────────────────────────────────────────────────────

export const getUnifiedMapNearby = (lat, lng, radius_km = 25, mode = 'drivers') =>
  request('GET', `/api/unified_map/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}&mode=${encodeURIComponent(mode)}`)

// ── E2E Encryption – public key ───────────────────────────────────────────────

export const storePublicKey = (public_key) =>
  request('PUT', '/api/auth/public_key', { public_key })

export const getUserPublicKey = (userId) =>
  request('GET', `/api/users/${encodeURIComponent(userId)}/public_key`)

// ── Users ─────────────────────────────────────────────────────────────────────

export const listUsers = () => request('GET', '/api/users/list')

export const searchUsers = (q) =>
  request('GET', `/api/users/search?q=${encodeURIComponent(q)}`)

// ── Admin — Users ─────────────────────────────────────────────────────────────

export const getAdminUsers = () => request('GET', '/api/admin/users')

export const adminDeleteUser = (userId) =>
  request('DELETE', `/api/admin/users/${encodeURIComponent(userId)}`)

// ── Admin — Broadcasts ────────────────────────────────────────────────────────

export const getAdminBroadcasts = () => request('GET', '/api/admin/broadcasts')

export const adminCancelBroadcast = (broadcastId) =>
  request('DELETE', `/api/admin/broadcasts/${encodeURIComponent(broadcastId)}`)

// ── Receipts ──────────────────────────────────────────────────────────────────

export const getReceipts = () => request('GET', '/api/receipts')

// ── Direct Messaging ──────────────────────────────────────────────────────────

export const dmListConversations = (search = null) =>
  request('GET', `/api/dm/conversations${search ? '?search=' + encodeURIComponent(search) : ''}`)

export const dmGetContacts = () => request('GET', '/api/dm/contacts')

export const dmStartConversation = (other_user_id) =>
  request('POST', '/api/dm/conversations', { other_user_id })

export const dmGetMessages = (convId) =>
  request('GET', `/api/dm/conversations/${encodeURIComponent(convId)}/messages`)

export const dmSendMessage = (conv_id, content, reply_to_id = null) =>
  request('POST', '/api/dm/messages', { conv_id, content, reply_to_id })

export const dmMarkRead = (convId) =>
  request('POST', `/api/dm/conversations/${encodeURIComponent(convId)}/read`, {})

export const dmDeleteConversation = (convId) =>
  request('DELETE', `/api/dm/conversations/${encodeURIComponent(convId)}`)

// ── Aliased DM helpers (used by InboxPage) ────────────────────────────────────

export const getDmConversations = (search = '') =>
  request('GET', `/api/dm/conversations${search ? '?search=' + encodeURIComponent(search) : ''}`)

export const getDmContacts = () => request('GET', '/api/dm/contacts')

export const getDmMessages = (userId) =>
  request('GET', `/api/dm/${encodeURIComponent(userId)}/messages`)

export const sendDmMessage = (userId, content) =>
  request('POST', `/api/dm/${encodeURIComponent(userId)}/messages`, { content })

export const markNotificationsRead = () =>
  request('POST', '/api/notifications/read_all', {})

const BASE = ''  // same origin

async function request(method, path, body = null, isJSON = true) {
  const opts = {
    method,
    credentials: 'include',
    headers: {},
  }
  if (body !== null) {
    if (isJSON) {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(body)
    } else {
      // FormData — let browser set Content-Type with boundary
      opts.body = body
    }
  }
  const res = await fetch(BASE + path, opts)
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) {
    const data = await res.json()
    if (!res.ok) throw Object.assign(new Error(data.error || data.detail || 'Request failed'), { status: res.status, data })
    return data
  }
  if (!res.ok) throw Object.assign(new Error('Request failed'), { status: res.status })
  return res
}

function formBody(obj) {
  const fd = new FormData()
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v) })
  return fd
}
