import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, Edit2, Trash2, Loader2, X } from 'lucide-react'
import { api, Category } from '../api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import ConfirmDialog from '../components/ui/confirm-dialog'

export default function Tags() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [tagToDelete, setTagToDelete] = useState<Category | null>(null)
  
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formColor, setFormColor] = useState('#6366f1')

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string }) => api.createCategory(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); closeCreateModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; description?: string; color?: string } }) => api.updateCategory(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); closeEditModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteCategory(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }) },
  })

  const openCreateModal = () => { setFormName(''); setFormDescription(''); setFormColor('#6366f1'); setShowCreateModal(true) }
  const closeCreateModal = () => setShowCreateModal(false)

  const openEditModal = (cat: Category) => {
    setSelectedCategory(cat)
    setFormName(cat.name)
    setFormDescription(cat.description || '')
    setFormColor(cat.color || '#6366f1')
    setShowEditModal(true)
  }
  const closeEditModal = () => { setShowEditModal(false); setSelectedCategory(null) }

  const handleCreate = () => {
    if (!formName.trim()) return
    createMutation.mutate({ name: formName.trim(), description: formDescription.trim() || undefined, color: formColor })
  }

  const handleUpdate = () => {
    if (!selectedCategory || !formName.trim()) return
    updateMutation.mutate({ id: selectedCategory.id, data: { name: formName.trim(), description: formDescription.trim() || undefined, color: formColor } })
  }

  const handleDelete = () => {
    if (tagToDelete) deleteMutation.mutate(tagToDelete.id)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tags & Categories</h1>
        <button onClick={openCreateModal} className="bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-lg transition shadow-sm flex items-center gap-2">
          <Plus size={20} /> New Tag
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12">
          <Tag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No tags yet</h3>
          <button onClick={openCreateModal} className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-md transition">
            <Plus size={20} /> Create Tag
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div key={cat.id} className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm hover:border-violet-300 transition group flex items-start gap-3">
              <div className="w-4 h-full rounded-full self-stretch" style={{ backgroundColor: cat.color || '#6366f1', width: '4px' }}></div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEditModal(cat)} className="p-1 text-slate-400 hover:text-violet-600"><Edit2 size={14} /></button>
                    {!cat.is_system && (
                      <button onClick={() => setTagToDelete(cat)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                {cat.description && <p className="text-sm text-slate-500 mt-1">{cat.description}</p>}
                {cat.is_system && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-2 inline-block">System</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="flex gap-2">
                {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'].map(c => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${formColor === c ? 'border-slate-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={closeCreateModal} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={!formName.trim() || createMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
              {createMutation.isPending && <Loader2 size={16} className="animate-spin" />} Create
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <div className="flex gap-2">
                {['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e'].map(c => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${formColor === c ? 'border-slate-900' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={closeEditModal} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium">Cancel</button>
            <button onClick={handleUpdate} disabled={!formName.trim() || updateMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
              {updateMutation.isPending && <Loader2 size={16} className="animate-spin" />} Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={!!tagToDelete}
        onClose={() => setTagToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Tag"
        description={`Are you sure you want to delete "${tagToDelete?.name}"?`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
