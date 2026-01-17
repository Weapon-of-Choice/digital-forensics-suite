import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ListTodo, CheckCircle2, Circle, Clock, Plus, X, Trash2, Loader2 } from 'lucide-react'
import { formatDueDate, isPast, isToday, isTomorrow } from 'date-fns'
import { format } from 'date-fns'
import { api, Task, Case } from '../api'

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed'

export default function Tasks() {
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Form state
  const [formCaseId, setFormCaseId] = useState<number | ''>('')
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [formDueDate, setFormDueDate] = useState('')

  // Fetch tasks
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', statusFilter === 'all' ? undefined : statusFilter],
    queryFn: () => api.getGlobalTasks(statusFilter === 'all' ? undefined : statusFilter),
  })

  // Fetch cases for the dropdown
  const { data: cases = [] } = useQuery({
    queryKey: ['cases'],
    queryFn: api.getCases,
  })

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: ({ caseId, data }: { caseId: number; data: { title: string; description?: string; priority?: string; due_date?: string } }) =>
      api.createTask(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      closeCreateModal()
    },
    onError: (error) => {
      console.error('Failed to create task:', error)
      alert('Failed to create task. Please try again.')
    },
  })

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Partial<Task> }) =>
      api.updateTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => api.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const openCreateModal = () => {
    setFormCaseId('')
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormDueDate('')
    setShowCreateModal(true)
  }

  const closeCreateModal = () => {
    setShowCreateModal(false)
  }

  const handleCreate = () => {
    if (!formCaseId || !formTitle.trim()) return
    createMutation.mutate({
      caseId: formCaseId as number,
      data: {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        priority: formPriority,
        due_date: formDueDate || undefined,
      },
    })
  }

  const handleToggleComplete = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed'
    updateMutation.mutate({
      taskId: task.id,
      data: { status: newStatus },
    })
  }

  const handleDelete = (taskId: number) => {
    if (confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate(taskId)
    }
  }

  const getCaseName = (caseId: number) => {
    const c = cases.find((cs: Case) => cs.id === caseId)
    return c ? c.name : `Case #${caseId}`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    if (isPast(date)) return `Overdue (${format(date, 'MMM d')})`
    return format(date, 'MMM d')
  }

  const getDueDateClass = (dateStr?: string) => {
    if (!dateStr) return 'text-slate-500'
    const date = new Date(dateStr)
    if (isPast(date) && !isToday(date)) return 'text-red-600'
    if (isToday(date)) return 'text-amber-600'
    return 'text-slate-500'
  }

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 text-red-600 border-red-200'
      case 'medium':
        return 'bg-amber-50 text-amber-600 border-amber-200'
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200'
    }
  }

  // Sort tasks: pending first, then in_progress, then completed
  const sortedTasks = [...tasks].sort((a, b) => {
    const statusOrder = { pending: 0, in_progress: 1, completed: 2 }
    const aOrder = statusOrder[a.status as keyof typeof statusOrder] ?? 1
    const bOrder = statusOrder[b.status as keyof typeof statusOrder] ?? 1
    if (aOrder !== bOrder) return aOrder - bOrder
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
        <div className="flex gap-2">
          {(['all', 'pending', 'in_progress', 'completed'] as StatusFilter[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                statusFilter === status
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {status === 'all' ? 'All' : status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          Failed to load tasks. Please try again.
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No tasks found</h3>
          <p className="text-slate-500 mb-4">
            {statusFilter === 'all'
              ? 'Create your first task to start tracking your work.'
              : `No ${statusFilter.replace('_', ' ')} tasks.`}
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2 rounded-lg transition"
          >
            <Plus size={20} />
            Create Task
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-4 text-sm font-medium text-slate-500">
            <div className="w-8"></div>
            <div className="flex-1">Task</div>
            <div className="w-24">Priority</div>
            <div className="w-32">Due Date</div>
            <div className="w-32">Case</div>
            <div className="w-16"></div>
          </div>

          <div className="divide-y divide-slate-100">
            {sortedTasks.map((task) => (
              <div
                key={task.id}
                className="p-4 flex items-center gap-4 hover:bg-slate-50 transition group"
              >
                <button
                  onClick={() => handleToggleComplete(task)}
                  disabled={updateMutation.isPending}
                  className="text-slate-400 hover:text-slate-900 transition disabled:opacity-50"
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  ) : (
                    <Circle size={20} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium truncate ${
                      task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-slate-500 truncate">{task.description}</p>
                  )}
                </div>
                <div className="w-24">
                  <span
                    className={`text-xs px-2 py-1 rounded font-medium border ${getPriorityClass(
                      task.priority
                    )}`}
                  >
                    {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                  </span>
                </div>
                <div className={`w-32 text-sm flex items-center gap-2 ${getDueDateClass(task.due_date)}`}>
                  {task.due_date && (
                    <>
                      <Clock size={14} />
                      {formatDate(task.due_date)}
                    </>
                  )}
                </div>
                <div className="w-32">
                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded truncate block">
                    {getCaseName(task.case_id)}
                  </span>
                </div>
                <div className="w-16 flex justify-end">
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={deleteMutation.isPending}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-600 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 text-center border-t border-slate-200">
            <button
              onClick={openCreateModal}
              className="text-sm text-slate-500 hover:text-slate-900 transition flex items-center justify-center gap-2 w-full"
            >
              <Plus size={16} />
              Add New Task
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Create Task</h2>
              <button onClick={closeCreateModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Case *</label>
                <select
                  value={formCaseId}
                  onChange={(e) => setFormCaseId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
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
                  placeholder="Task title"
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Task description (optional)"
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900 placeholder-slate-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-slate-900"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={closeCreateModal}
                className="px-4 py-2 text-slate-700 hover:text-slate-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!formCaseId || !formTitle.trim() || createMutation.isPending}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
