import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useChildAuth } from './context/ChildAuthContext'
import Login from './pages/Login'
import ParentDashboard from './pages/ParentDashboard'
import ChildSelect from './pages/ChildSelect'
import ChildView from './pages/ChildView'
import KidsHomework from './pages/KidsHomework'
import KidsGame from './pages/KidsGame'
import UploadMaterial from './pages/UploadMaterial'

function ProtectedRoute({ children, requireRole }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'var(--font-display)', color:'var(--text-secondary)' }}>Laddar...</div>
  if (!user) return <Navigate to="/login" replace />
  if (requireRole && profile?.role !== requireRole) return <Navigate to="/" replace />
  return children
}

function ChildProtectedRoute({ children }) {
  const { childUser } = useChildAuth()
  if (!childUser) return <Navigate to="/kids" replace />
  return children
}

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />

      <Route path="/" element={
        <ProtectedRoute>
          {!profile
            ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'var(--font-display)', color:'var(--text-secondary)' }}>Laddar...</div>
            : profile.role === 'parent'
              ? <ParentDashboard />
              : <Navigate to="/kids" replace />}
        </ProtectedRoute>
      } />

      <Route path="/upload/:childId" element={
        <ProtectedRoute requireRole="parent"><UploadMaterial /></ProtectedRoute>
      } />

      <Route path="/child/:childId" element={
        <ProtectedRoute requireRole="parent"><ChildView /></ProtectedRoute>
      } />

      {/* Barnens inloggning och vy — ingen Supabase-auth krävs */}
      <Route path="/kids" element={<ChildSelect />} />
      <Route path="/kids/:childId" element={
        <ChildProtectedRoute><KidsHomework /></ChildProtectedRoute>
      } />
      <Route path="/kids/:childId/game" element={
        <ChildProtectedRoute><KidsGame /></ChildProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
