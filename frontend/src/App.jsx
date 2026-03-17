import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { getAdminAuthStatus } from './api'
import Home from './pages/Home'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null) // null=loading, false=not logged in, object=logged in
  const checkAuth = async () => {
    try {
      const data = await getAdminAuthStatus()
      setAdmin(data.logged_in ? data : false)
    } catch {
      setAdmin(false)
    }
  }
  useEffect(() => { checkAuth() }, [])

  return (
    <AuthCtx.Provider value={{ admin, setAdmin, checkAuth }}>
      {children}
    </AuthCtx.Provider>
  )
}

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { admin } = useAuth()
  if (admin === null) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="spinner w-10 h-10" />
      </div>
    )
  }
  if (!admin) return <Navigate to="/admin/login" replace />
  return children
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminLogin register />} />
          <Route path="/const" element={
            <ProtectedRoute><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute><AdminDashboard /></ProtectedRoute>
          } />
          {/* Catch-all → Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
