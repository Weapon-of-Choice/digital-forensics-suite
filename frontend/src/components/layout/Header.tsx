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

      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </header>
  )
}
