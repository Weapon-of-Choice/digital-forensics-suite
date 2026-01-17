import { useState } from 'react'
import { Search, LogOut, LogIn, Loader2, User } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import SearchModal from '../search/SearchModal'

export default function Header() {
  const { isLoading, isAuthenticated, user, login, logout, isAdmin } = useAuth()
  const [showSearch, setShowSearch] = useState(false)

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0">
      {/* Search Trigger */}
      <button 
        onClick={() => setShowSearch(true)}
        className="flex items-center gap-2 text-slate-500 hover:text-violet-600 transition bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-full border border-slate-200 w-64"
      >
        <Search size={18} />
        <span className="text-sm">Search...</span>
      </button>

      {/* User Profile */}
      <div className="flex items-center gap-4">
        {isLoading ? (
            <Loader2 size={18} className="animate-spin text-slate-400" />
        ) : isAuthenticated ? (
          <div className="flex items-center gap-3">
             <div className="text-right hidden sm:block">
               <p className="text-sm font-medium text-slate-900">{user?.name || user?.username}</p>
               <p className="text-xs text-slate-500">{isAdmin ? 'Administrator' : 'Analyst'}</p>
             </div>
             <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 border border-violet-200">
               <User size={18} />
             </div>
             <button onClick={logout} className="text-slate-400 hover:text-red-600 transition p-2" title="Sign out">
               <LogOut size={18} />
             </button>
          </div>
        ) : (
          <button onClick={login} className="flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-violet-600">
            <LogIn size={18} /> Sign in
          </button>
        )}
      </div>

      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  )
}
