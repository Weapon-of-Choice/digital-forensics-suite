import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, Plus, X, Eye, ChevronRight, Edit2, Trash2, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api, Watchlist, WatchlistEntry } from '../api'

export default function Watchlists() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEntriesModal, setShowEntriesModal] = useState(false)
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)
  const [selectedWatchlist, setSelectedWatchlist] = useState<Watchlist | null>(null)
  const [showActiveOnly, setShowActiveOnly] = useState(false)

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formAlertOnMatch, setFormAlertOnMatch] = useState(true)
  const [formIsActive, setFormIsActive] = useState(true)

  const [entryName, setEntryName] = useState('')
  const [entryNotes, setEntryNotes] = useState('')

  const { data: watchlists = [], isLoading } = useQuery({
    queryKey: ['watchlists', showActiveOnly],
    queryFn: () => api.getWatchlists(showActiveOnly),
  })

  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ['watchlist-entries', selectedWatchlist?.id],
    queryFn: () => (selectedWatchlist ? api.getWatchlistEntries(selectedWatchlist.id) : Promise.resolve([])),
    enabled: !!selectedWatchlist && showEntriesModal,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; alert_on_match?: boolean }) => api.createWatchlist(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlists'] }); closeCreateModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; is_active?: boolean; alert_on_match?: boolean } }) =>
      api.updateWatchlist(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlists'] }); closeEditModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteWatchlist(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlists'] }),
  })

  const addEntryMutation = useMutation({
    mutationFn: ({ watchlistId, data }: { watchlistId: number; data: { name?: string; notes?: string } }) =>
      api.addWatchlistEntry(watchlistId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['watchlist-entries', selectedWatchlist?.id] }); closeAddEntryModal() },
  })

  const deleteEntryMutation = useMutation({
    mutationFn: ({ watchlistId, entryId }: { watchlistId: number; entryId: number }) =>
      api.deleteWatchlistEntry(watchlistId, entryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist-entries', selectedWatchlist?.id] }),
  })

  const openCreateModal = () => { setFormName(''); setFormDescription(''); setFormAlertOnMatch(true); setShowCreateModal(true) }
  const closeCreateModal = () => setShowCreateModal(false)

  const openEditModal = (wl: Watchlist) => {
    setSelectedWatchlist(wl)
    setFormName(wl.name)
    setFormDescription(wl.description || '')
    setFormAlertOnMatch(wl.alert_on_match)
    setFormIsActive(wl.is_active)
    setShowEditModal(true)
  }
  const closeEditModal = () => { setShowEditModal(false); setSelectedWatchlist(null) }

  const openEntriesModal = (wl: Watchlist) => { setSelectedWatchlist(wl); setShowEntriesModal(true) }
  const closeEntriesModal = () => { setShowEntriesModal(false); setSelectedWatchlist(null) }

  const openAddEntryModal = () => { setEntryName(''); setEntryNotes(''); setShowAddEntryModal(true) }
  const closeAddEntryModal = () => setShowAddEntryModal(false)

  const handleCreate = () => {
    if (!formName.trim()) return
    createMutation.mutate({ name: formName.trim(), description: formDescription.trim() || undefined, alert_on_match: formAlertOnMatch })
  }

  const handleUpdate = () => {
    if (!selectedWatchlist || !formName.trim()) return
    updateMutation.mutate({ id: selectedWatchlist.id, data: { name: formName.trim(), description: formDescription.trim() || undefined, is_active: formIsActive, alert_on_match: formAlertOnMatch } })
  }

  const handleDelete = (wl: Watchlist) => {
    if (confirm(`Delete watchlist "${wl.name}"?`)) deleteMutation.mutate(wl.id)
  }

  const handleAddEntry = () => {
    if (!selectedWatchlist || !entryName.trim()) return
    addEntryMutation.mutate({ watchlistId: selectedWatchlist.id, data: { name: entryName.trim(), notes: entryNotes.trim() || undefined } })
  }

  const handleDeleteEntry = (entry: WatchlistEntry) => {
    if (!selectedWatchlist || !confirm('Delete this entry?')) return
    deleteEntryMutation.mutate({ watchlistId: selectedWatchlist.id, entryId: entry.id })
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Watchlists</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showActiveOnly} onChange={(e) => setShowActiveOnly(e.target.checked)} className="w-4 h-4 text-violet-600 border-slate-300 rounded" />
            <span className="text-sm text-slate-600">Active only</span>
          </label>
          <button onClick={openCreateModal} className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-2">
            <Plus size={20} /> Create List
          </button>
        </div>
      </div>

      {watchlists.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No watchlists yet</h3>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-md transition">
            <Plus size={20} /> Create Watchlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {watchlists.map((wl) => (
            <div key={wl.id} className={`bg-white rounded-lg p-6 border shadow-sm ${wl.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg border bg-red-50 text-red-600 border-red-100"><Shield size={24} /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 truncate">{wl.name}</h3>
                  <p className="text-sm text-slate-500">{wl.alert_on_match ? 'Alerts enabled' : 'Alerts disabled'}</p>
                </div>
                {!wl.is_active && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">Inactive</span>}
              </div>
              {wl.description && <p className="text-sm text-slate-600 mb-4 line-clamp-2">{wl.description}</p>}
              <div className="text-xs text-slate-400 mb-4">Created {formatDistanceToNow(new Date(wl.created_at), { addSuffix: true })}</div>
              <div className="flex gap-2 border-t border-slate-100 pt-4">
                <button onClick={() => openEntriesModal(wl)} className="flex-1 py-2 text-sm text-slate-500 hover:text-violet-600 transition flex items-center justify-center gap-1">
                  <Eye size={16} /> Entries
                </button>
                <button onClick={() => openEditModal(wl)} className="flex-1 py-2 text-sm text-slate-500 hover:text-violet-600 transition flex items-center justify-center gap-1">
                  <Edit2 size={16} /> Edit
                </button>
                <button onClick={() => handleDelete(wl)} className="py-2 px-3 text-sm text-red-500 hover:text-red-600 transition">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Create Watchlist</h2>
              <button onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Watchlist name" className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional description" rows={3} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formAlertOnMatch} onChange={(e) => setFormAlertOnMatch(e.target.checked)} className="w-4 h-4 text-violet-600 border-slate-300 rounded" />
                <span className="text-sm text-slate-700">Alert on match</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
              <button onClick={closeCreateModal} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition">Cancel</button>
              <button onClick={handleCreate} disabled={!formName.trim() || createMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2">
                {createMutation.isPending && <Loader2 size={16} className="animate-spin" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedWatchlist && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Edit Watchlist</h2>
              <button onClick={closeEditModal} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} className="w-4 h-4 text-violet-600 border-slate-300 rounded" />
                <span className="text-sm text-slate-700">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={formAlertOnMatch} onChange={(e) => setFormAlertOnMatch(e.target.checked)} className="w-4 h-4 text-violet-600 border-slate-300 rounded" />
                <span className="text-sm text-slate-700">Alert on match</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
              <button onClick={closeEditModal} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition">Cancel</button>
              <button onClick={handleUpdate} disabled={!formName.trim() || updateMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2">
                {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entries Modal */}
      {showEntriesModal && selectedWatchlist && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedWatchlist.name}</h2>
                <p className="text-sm text-slate-500">Watchlist entries</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={openAddEntryModal} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-md transition flex items-center gap-1">
                  <Plus size={16} /> Add Entry
                </button>
                <button onClick={closeEntriesModal} className="text-slate-400 hover:text-slate-600 p-2"><X size={20} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {entriesLoading ? (
                <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
              ) : entries.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No entries in this watchlist yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry: WatchlistEntry) => (
                    <div key={entry.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{entry.name || `Entry #${entry.id}`}</p>
                        {entry.notes && <p className="text-sm text-slate-500 truncate">{entry.notes}</p>}
                      </div>
                      <span className="text-xs text-slate-400">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
                      <button onClick={() => handleDeleteEntry(entry)} className="text-red-500 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddEntryModal && selectedWatchlist && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Add Entry</h2>
              <button onClick={closeAddEntryModal} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input type="text" value={entryName} onChange={(e) => setEntryName(e.target.value)} placeholder="Person name or identifier" className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <input type="text" value={entryNotes} onChange={(e) => setEntryNotes(e.target.value)} placeholder="Optional notes" className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
              <button onClick={closeAddEntryModal} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition">Cancel</button>
              <button onClick={handleAddEntry} disabled={!entryName.trim() || addEntryMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2">
                {addEntryMutation.isPending && <Loader2 size={16} className="animate-spin" />} Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
