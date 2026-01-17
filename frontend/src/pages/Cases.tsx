import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, Case } from '../api'
import { Plus, Trash2, FolderOpen, Loader2 } from 'lucide-react'
import ConfirmDialog from '../components/ui/confirm-dialog'

export default function Cases() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { data: cases, isLoading, error } = useQuery({ queryKey: ['cases'], queryFn: api.getCases })

  const createMutation = useMutation({
    mutationFn: api.createCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      setShowCreate(false)
      setName('')
      setDescription('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteCase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] })
      setCaseToDelete(null)
    },
  })

  const handleDelete = () => {
    if (caseToDelete) {
      deleteMutation.mutate(caseToDelete.id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg">
        Failed to load cases.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Cases</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-md transition shadow-sm"
        >
          <Plus size={20} />
          New Case
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-slate-200 animate-in fade-in slide-in-from-top-4 duration-200">
          <h2 className="text-lg font-semibold mb-4 text-slate-900">Create New Case</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Case Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder-slate-400"
            />
            <textarea
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder-slate-400 resize-none"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({ name, description })}
                disabled={!name || createMutation.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 px-6 py-2 rounded-md transition shadow-sm flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                {createMutation.isPending ? 'Creating...' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cases?.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen size={48} className="mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500">No cases yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cases?.map(c => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-5 hover:border-violet-300 hover:shadow-md transition group relative">
              <div className="flex items-start justify-between">
                <Link to={`/cases/${c.id}`} className="flex-1 block">
                  <h3 className="font-semibold text-lg text-slate-900 group-hover:text-violet-600 transition">{c.name}</h3>
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{c.description || 'No description'}</p>
                  <p className="text-xs text-slate-400 mt-3">
                    Created {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setCaseToDelete(c)
                  }}
                  className="text-slate-400 hover:text-red-600 transition p-2 hover:bg-red-50 rounded-full"
                  title="Delete Case"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!caseToDelete}
        onClose={() => setCaseToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Case"
        description={`Are you sure you want to delete case "${caseToDelete?.name}"? All associated media and data will be permanently removed.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  )
}
