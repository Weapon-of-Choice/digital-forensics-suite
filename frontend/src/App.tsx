import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { 
  FolderOpen, Map, Search, Home, Clock, StickyNote, 
  ListTodo, Shield, Bell, Users, LogIn, LogOut, Loader2, Activity 
} from 'lucide-react'
import { useAuth } from './lib/AuthContext'
import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import MapView from './pages/MapView'
import SearchPage from './pages/SearchPage'
import Timeline from './pages/Timeline'
import Notes from './pages/Notes'
import Tasks from './pages/Tasks'
import Watchlists from './pages/Watchlists'
import Alerts from './pages/Alerts'
import Persons from './pages/Persons'
import QueueMonitor from './pages/QueueMonitor'

const navItems = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/cases', icon: FolderOpen, label: 'Cases' },
  { path: '/map', icon: Map, label: 'Map' },
  { path: '/search', icon: Search, label: 'Search' },
  { path: '/timeline', icon: Clock, label: 'Timeline' },
  { path: '/notes', icon: StickyNote, label: 'Notes' },
  { path: '/tasks', icon: ListTodo, label: 'Tasks' },
  { path: '/watchlists', icon: Shield, label: 'Watchlists' },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/persons', icon: Users, label: 'Persons' },
  { path: '/queue', icon: Activity, label: 'Queue' },
]

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      </div>
    )
  }
  
  if (!isAuthenticated) {
    return null
  }
  
  return <>{children}</>
}

export default function App() {
  const location = useLocation()
  const { isLoading, isAuthenticated, user, login, logout, isAdmin } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
        <span className="ml-3 text-slate-500">Initializing...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    login()
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
        <span className="ml-3 text-slate-500">Redirecting to login...</span>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Sidebar */}
      <nav className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 tracking-tight">Forensic Analysis</h1>
              <p className="text-xs text-slate-500">Investigation Platform</p>
            </div>
          </div>
        </div>
        
        <ul className="flex-1 p-3 space-y-1 overflow-auto">
          {navItems.map(({ path, icon: Icon, label }) => (
            <li key={path}>
              <Link
                to={path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition font-medium ${
                  location.pathname === path
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Auth section */}
        <div className="p-3 border-t border-slate-200">
          {isLoading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : isAuthenticated ? (
            <div className="space-y-2">
              <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-800">{user?.name || user?.username}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                {isAdmin && (
                  <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 rounded">
                    Admin
                  </span>
                )}
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={login}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm bg-slate-900 text-white font-medium hover:bg-slate-800 transition rounded-lg"
            >
              <LogIn size={16} />
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50 p-6">
        <Routes>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/cases" element={<ProtectedRoute><Cases /></ProtectedRoute>} />
          <Route path="/cases/:id" element={<ProtectedRoute><CaseDetail /></ProtectedRoute>} />
          <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
          <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
          <Route path="/watchlists" element={<ProtectedRoute><Watchlists /></ProtectedRoute>} />
          <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
          <Route path="/persons" element={<ProtectedRoute><Persons /></ProtectedRoute>} />
          <Route path="/queue" element={<ProtectedRoute><QueueMonitor /></ProtectedRoute>} />
        </Routes>
      </main>
    </div>
  )
}
