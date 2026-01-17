import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StickyNote, Plus, X, Pin, PinOff, Pencil, Trash2, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api, CaseNote, Case } from '../api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import ConfirmDialog from '../components/ui/confirm-dialog'

export default function Notes() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedNote, setSelectedNote] = useState<CaseNote | null>(null)
  const [noteToDelete, setNoteToDelete] = useState<CaseNote | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Form state
  const [formCaseId, setFormCaseId] = useState<number | ''>('')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formPinned, setFormPinned] = useState(false)

  // Helpers (Before Mutations)
  const openCreateModal = () => {
    setFormCaseId('')
    setFormTitle('')
    setFormContent('')
    setFormPinned(false)
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
    setFormCaseId('')
    setFormTitle('')
    setFormContent('')
    setFormPinned(false)
  }

  const openViewModal = (note: CaseNote) => {
    setSelectedNote(note)
    setFormTitle(note.title || '')
    setFormContent(note.content)
    setFormPinned(note.is_pinned)
    setEditMode(false)
    setShowViewModal(true)
  }

  const closeViewModal = () => {
    setShowViewModal(false)
    setSelectedNote(null)
    setEditMode(false)
  }

  // Fetch notes
  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ['notes'],
    queryFn: api.getGlobalNotes,
  })

  // Fetch cases for the dropdown
  const { data: cases = [] } = useQuery({
    queryKey: ['cases'],
    queryFn: api.getCases,
  })

  // Create note mutation
  const createMutation = useMutation({
    mutationFn: ({ caseId, data }: { caseId: number; data: { title: string; content: string; is_pinned?: boolean } }) =>
      api.createNote(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      closeCreateModal()
    },
  })

  // Update note mutation
  const updateMutation = useMutation({
    mutationFn: ({ noteId, data }: { noteId: number; data: { title?: string; content?: string; is_pinned?: boolean } }) =>
      api.updateNote(noteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      // Keep view modal open but exit edit mode
      setEditMode(false)
    },
  })

  // Delete note mutation
  const deleteMutation = useMutation({
    mutationFn: (noteId: number) => api.deleteNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      closeViewModal()
      setNoteToDelete(null)
    },
  })

  // Handlers
  const handleCreate = () => {
    if (!formCaseId || !formTitle.trim()) return
    createMutation.mutate({
      caseId: formCaseId as number,
      data: { title: formTitle.trim(), content: formContent.trim(), is_pinned: formPinned },
    })
  }

  const handleUpdate = () => {
    if (!selectedNote || !formTitle.trim()) return
    updateMutation.mutate({
      noteId: selectedNote.id,
      data: { title: formTitle.trim(), content: formContent.trim(), is_pinned: formPinned },
    })
  }

  const handleDelete = () => {
    if (noteToDelete) {
      deleteMutation.mutate(noteToDelete.id)
    }
  }

  const handleTogglePin = (note: CaseNote, e: React.MouseEvent) => {
    e.stopPropagation()
    updateMutation.mutate({
      noteId: note.id,
      data: { is_pinned: !note.is_pinned },
    })
  }

  // Sort notes: pinned first, then by created_at desc
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const getCaseName = (caseId: number) => {
    const c = cases.find((cs: Case) => cs.id === caseId)
    return c ? c.name : `Case #${caseId}`
  }

  const safeDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date'
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return 'Unknown date'
    }
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        <StickyNote className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium">Failed to load notes</h3>
        <p className="text-sm mt-2">Please try again later.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Case Notes</h1>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-md transition shadow-sm"
        >
          <Plus size={20} />
          Add Note
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
        </div>
      ) : sortedNotes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <StickyNote className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No notes yet</h3>
          <p className="text-slate-500 mb-4">Create your first note to start documenting your investigation.</p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-md transition"
          >
            <Plus size={20} />
            Create Note
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              onClick={() => openViewModal(note)}
              className="bg-white rounded-lg p-6 border border-slate-200 hover:border-violet-300 transition cursor-pointer group shadow-sm relative"
            >
              <button
                 onClick={(e) => handleTogglePin(note, e)}
                 className={`absolute top-3 right-3 p-1 rounded-full hover:bg-slate-100 transition ${note.is_pinned ? 'text-violet-600' : 'text-slate-300 hover:text-slate-600'}`}
                 title={note.is_pinned ? "Unpin" : "Pin"}
              >
                <Pin size={16} fill={note.is_pinned ? "currentColor" : "none"} />
              </button>
              
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-violet-50 rounded-md text-violet-600 group-hover:bg-violet-100 transition">
                  <StickyNote size={20} />
                </div>
                <span className="text-xs text-slate-500 mr-6">
                  {safeDate(note.created_at)}
                </span>
              </div>
              <h3 className="font-semibold text-slate-900 mb-2 truncate pr-4">{note.title}</h3>
              <p className="text-slate-600 text-sm line-clamp-3">{note.content}</p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded truncate max-w-full">
                  {getCaseName(note.case_id)}
                </span>
              </div>
            </div>
          ))}

          <button
            onClick={openCreateModal}
            className="flex flex-col items-center justify-center gap-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg p-6 hover:border-violet-300 hover:bg-slate-100 transition group min-h-[200px]"
          >
            <div className="p-3 bg-white rounded-full text-slate-400 group-hover:text-violet-600 transition shadow-sm border border-slate-200">
              <Plus size={24} />
            </div>
            <p className="font-medium text-slate-500 group-hover:text-violet-600">Create New Note</p>
          </button>
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Case *</label>
              <select
                value={formCaseId}
                onChange={(e) => setFormCaseId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900"
              >
                <option value="">Select a case...</option>
                {cases.map((c: Case) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Note title"
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 placeholder-slate-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Write your note..."
                rows={5}
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 placeholder-slate-400 resize-none"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formPinned}
                onChange={(e) => setFormPinned(e.target.checked)}
                className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700">Pin this note</span>
            </label>
          </div>
          <DialogFooter>
            <button
              onClick={closeCreateModal}
              className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!formCaseId || !formTitle.trim() || createMutation.isPending}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View/Edit Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit Note' : 'View Note'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editMode && (
               <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block">
                {selectedNote && getCaseName(selectedNote.case_id)}
              </div>
            )}
            
            {editMode ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={6}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formPinned}
                    onChange={(e) => setFormPinned(e.target.checked)}
                    className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
                  />
                  <span className="text-sm text-slate-700">Pin this note</span>
                </label>
              </>
            ) : (
              selectedNote && (
                <>
                  <h3 className="text-xl font-semibold text-slate-900">{selectedNote.title}</h3>
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedNote.content}</p>
                </>
              )
            )}
            
            {!editMode && selectedNote && (
               <div className="text-xs text-slate-400">
                Created {safeDate(selectedNote.created_at)}
              </div>
            )}
          </div>
          
          <DialogFooter>
            {editMode ? (
               <>
                 <button
                   onClick={() => {
                     setEditMode(false)
                     setFormTitle(selectedNote.title)
                     setFormContent(selectedNote.content)
                   }}
                   className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={handleUpdate}
                   disabled={!formTitle.trim() || updateMutation.isPending}
                   className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                 >
                   {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                   Save
                 </button>
               </>
            ) : (
               <>
                 <div className="flex gap-2 mr-auto">
                    <button
                      onClick={() => setEditMode(true)}
                      className="p-2 text-slate-500 hover:text-violet-600 transition"
                      title="Edit"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => setNoteToDelete(selectedNote)}
                      className="p-2 text-slate-500 hover:text-red-600 transition"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                 </div>
                 <button
                   onClick={closeViewModal}
                   className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium"
                 >
                   Close
                 </button>
               </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
