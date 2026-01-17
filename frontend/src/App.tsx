import { Routes, Route, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from './lib/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'

import Dashboard from './pages/Dashboard'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import MapView from './pages/MapView'
import SearchPage from './pages/SearchPage'
import Timeline from './pages/Timeline'
import Tags from './pages/Tags'
import Notes from './pages/Notes'
import Tasks from './pages/Tasks'
import Watchlists from './pages/Watchlists'
import Alerts from './pages/Alerts'
import Persons from './pages/Persons'
import QueueMonitor from './pages/QueueMonitor'
import ServicesPlayground from './pages/ServicesPlayground'

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
  const { isLoading, isAuthenticated, login } = useAuth()

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
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/cases" element={<ProtectedRoute><Cases /></ProtectedRoute>} />
            <Route path="/cases/:id" element={<ProtectedRoute><CaseDetail /></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
            <Route path="/tags" element={<ProtectedRoute><Tags /></ProtectedRoute>} />
            <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/watchlists" element={<ProtectedRoute><Watchlists /></ProtectedRoute>} />
            <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
            <Route path="/persons" element={<ProtectedRoute><Persons /></ProtectedRoute>} />
            <Route path="/queue" element={<ProtectedRoute><QueueMonitor /></ProtectedRoute>} />
            <Route path="/playground" element={<ProtectedRoute><ServicesPlayground /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
