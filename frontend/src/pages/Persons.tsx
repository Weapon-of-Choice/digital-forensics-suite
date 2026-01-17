import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Search, Filter, X, Loader2, Shield, Calendar, Globe, Plus, Edit2, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { api, Person } from '../api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import ConfirmDialog from '../components/ui/confirm-dialog'
import { GridSkeleton } from '../components/ui/loading'

export default function Persons() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [watchlistOnly, setWatchlistOnly] = useState(false)
  
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null)
  
  const [showViewModal, setShowViewModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const [formName, setFormName] = useState('')
  const [formAliases, setFormAliases] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDob, setFormDob] = useState('')
  const [formNationality, setFormNationality] = useState('')
  const [formIsWatchlist, setFormIsWatchlist] = useState(false)
  const [formThreatLevel, setFormThreatLevel] = useState('')

  const { data: persons = [], isLoading } = useQuery({
    queryKey: ['persons', watchlistOnly],
    queryFn: () => api.getPersons(watchlistOnly),
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; aliases?: string; description?: string; date_of_birth?: string; nationality?: string; is_watchlist?: boolean; threat_level?: string }) =>
      api.createPerson(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['persons'] }); closeCreateModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Person> }) => api.updatePerson(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['persons'] }); closeEditModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deletePerson(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['persons'] }) },
  })

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons
    const query = searchQuery.toLowerCase()
    return persons.filter((p: Person) =>
      p.name.toLowerCase().includes(query) ||
      p.nationality?.toLowerCase().includes(query) ||
      p.aliases?.toLowerCase().includes(query)
    )
  }, [persons, searchQuery])

  const resetForm = () => {
    setFormName(''); setFormAliases(''); setFormDescription(''); setFormDob(''); setFormNationality(''); setFormIsWatchlist(false); setFormThreatLevel('')
  }

  const openCreateModal = () => { resetForm(); setShowCreateModal(true) }
  const closeCreateModal = () => setShowCreateModal(false)

  const openEditModal = (person: Person) => {
    setSelectedPerson(person)
    setFormName(person.name)
    setFormAliases(person.aliases || '')
    setFormDescription(person.description || '')
    setFormDob(person.date_of_birth ? person.date_of_birth.split('T')[0] : '')
    setFormNationality(person.nationality || '')
    setFormIsWatchlist(person.is_watchlist)
    setFormThreatLevel(person.threat_level || '')
    setShowEditModal(true)
  }
  const closeEditModal = () => { setShowEditModal(false); setSelectedPerson(null) }

  const openViewModal = (person: Person) => { setSelectedPerson(person); setShowViewModal(true) }
  const closeViewModal = () => { setShowViewModal(false); setSelectedPerson(null) }

  const handleCreate = () => {
    if (!formName.trim()) return
    createMutation.mutate({
      name: formName.trim(),
      aliases: formAliases.trim() || undefined,
      description: formDescription.trim() || undefined,
      date_of_birth: formDob || undefined,
      nationality: formNationality.trim() || undefined,
      is_watchlist: formIsWatchlist,
      threat_level: formThreatLevel || undefined,
    })
  }

  const handleUpdate = () => {
    if (!selectedPerson || !formName.trim()) return
    updateMutation.mutate({
      id: selectedPerson.id,
      data: {
        name: formName.trim(),
        aliases: formAliases.trim() || undefined,
        description: formDescription.trim() || undefined,
        date_of_birth: formDob || undefined,
        nationality: formNationality.trim() || undefined,
        is_watchlist: formIsWatchlist,
        threat_level: formThreatLevel || undefined,
      },
    })
  }

  const handleDelete = () => {
    if (personToDelete) deleteMutation.mutate(personToDelete.id)
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ')
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase()
  }

  const safeDate = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return 'Unknown date'
    }
  }

  if (isLoading) return <div className="mt-20"><GridSkeleton count={10} height="h-64" /></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Persons of Interest</h1>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search database..." className="bg-white border border-slate-300 text-slate-900 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 w-64 placeholder-slate-400 shadow-sm" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={16} /></button>}
          </div>
          <button onClick={() => setWatchlistOnly(!watchlistOnly)} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition shadow-sm border ${watchlistOnly ? 'bg-violet-600 text-white border-violet-700' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}>
            <Filter size={18} /> {watchlistOnly ? 'Watchlist Only' : 'All Persons'}
          </button>
          <button onClick={openCreateModal} className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-2">
            <Plus size={20} /> Add Person
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>
      ) : filteredPersons.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No persons found</h3>
          <p className="text-slate-500">{searchQuery ? `No results for "${searchQuery}".` : 'No persons of interest in the database.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredPersons.map((person: Person) => (
            <div key={person.id} className="bg-white rounded-lg overflow-hidden border border-slate-200 hover:shadow-md transition group shadow-sm">
              <div className="aspect-square bg-slate-100 relative cursor-pointer" onClick={() => openViewModal(person)}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500">{getInitials(person.name)}</div>
                </div>
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="bg-violet-600 text-white px-3 py-1 rounded-lg text-sm font-medium">View Details</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-slate-900 truncate flex-1">{person.name}</h3>
                  {person.is_watchlist && <Shield size={14} className="text-red-500 flex-shrink-0 ml-1" />}
                </div>
                <p className="text-xs text-slate-500 mb-2">ID: {person.id}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {person.nationality && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">{person.nationality}</span>}
                  {person.threat_level && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${person.threat_level === 'high' ? 'bg-red-50 text-red-600 border-red-100' : person.threat_level === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{person.threat_level}</span>}
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => openEditModal(person)} className="flex-1 py-1 text-xs text-slate-500 hover:text-violet-600 transition flex items-center justify-center gap-1"><Edit2 size={12} /> Edit</button>
                  <button onClick={() => setPersonToDelete(person)} className="py-1 px-2 text-xs text-red-500 hover:text-red-600 transition"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Person Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {selectedPerson && (
              <>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-500">{getInitials(selectedPerson.name)}</div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedPerson.name}</h3>
                    <p className="text-sm text-slate-500">ID: {selectedPerson.id}</p>
                    {selectedPerson.is_watchlist && <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 mt-1"><Shield size={12} /> On Watchlist</span>}
                  </div>
                </div>
                <div className="space-y-4">
                  {selectedPerson.aliases && <div><p className="text-xs text-slate-500">Aliases</p><p className="font-medium text-slate-900">{selectedPerson.aliases}</p></div>}
                  {selectedPerson.date_of_birth && <div className="flex items-center gap-3"><div className="p-2 bg-slate-100 rounded-lg"><Calendar size={18} className="text-slate-500" /></div><div><p className="text-xs text-slate-500">Date of Birth</p><p className="font-medium text-slate-900">{format(new Date(selectedPerson.date_of_birth), 'MMMM d, yyyy')}</p></div></div>}
                  {selectedPerson.nationality && <div className="flex items-center gap-3"><div className="p-2 bg-slate-100 rounded-lg"><Globe size={18} className="text-slate-500" /></div><div><p className="text-xs text-slate-500">Nationality</p><p className="font-medium text-slate-900">{selectedPerson.nationality}</p></div></div>}
                  {selectedPerson.threat_level && <div><p className="text-xs text-slate-500">Threat Level</p><p className={`font-medium capitalize ${selectedPerson.threat_level === 'high' ? 'text-red-600' : selectedPerson.threat_level === 'medium' ? 'text-amber-600' : 'text-slate-900'}`}>{selectedPerson.threat_level}</p></div>}
                  {selectedPerson.description && <div className="pt-4 border-t border-slate-100"><p className="text-xs text-slate-500 mb-2">Description</p><p className="text-slate-700 text-sm whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">{selectedPerson.description}</p></div>}
                  <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">Added {safeDate(selectedPerson.created_at)}</div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <button onClick={closeViewModal} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition text-sm font-medium">Close</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => !open && (showEditModal ? closeEditModal() : closeCreateModal())}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{showEditModal ? 'Edit Person' : 'Add Person'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Aliases</label>
              <input type="text" value={formAliases} onChange={(e) => setFormAliases(e.target.value)} placeholder="Known aliases (comma separated)" className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                <input type="date" value={formDob} onChange={(e) => setFormDob(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nationality</label>
                <input type="text" value={formNationality} onChange={(e) => setFormNationality(e.target.value)} placeholder="e.g. British" className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Threat Level</label>
              <select value={formThreatLevel} onChange={(e) => setFormThreatLevel(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500">
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Additional notes" rows={3} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formIsWatchlist} onChange={(e) => setFormIsWatchlist(e.target.checked)} className="w-4 h-4 text-violet-600 border-slate-300 rounded" />
              <span className="text-sm text-slate-700">Add to watchlist</span>
            </label>
          </div>
          <DialogFooter>
            <button onClick={showEditModal ? closeEditModal : closeCreateModal} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium">Cancel</button>
            <button onClick={showEditModal ? handleUpdate : handleCreate} disabled={!formName.trim() || (showEditModal ? updateMutation.isPending : createMutation.isPending)} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
              {(showEditModal ? updateMutation.isPending : createMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
              {showEditModal ? 'Save' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!personToDelete}
        onClose={() => setPersonToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Person"
        description={`Are you sure you want to delete "${personToDelete?.name}"?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
