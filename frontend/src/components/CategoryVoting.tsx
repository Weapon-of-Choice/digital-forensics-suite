import { useState } from 'react'
import { api, Category, MediaCategory, CaseCategory } from '../api'
import { ThumbsUp, ThumbsDown, Plus, Tag } from 'lucide-react'

interface Props {
  type: 'media' | 'case'
  targetId: number
  categories: (MediaCategory | CaseCategory)[]
  allCategories: Category[]
  onRefresh: () => void
}

export default function CategoryVoting({ type, targetId, categories, allCategories, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const userId = 'user-' + Math.random().toString(36).substr(2, 9)

  const handleVote = async (categoryEntryId: number, vote: 1 | -1) => {
    if (type === 'media') {
      await api.voteMediaCategory(categoryEntryId, userId, vote)
    } else {
      await api.voteCaseCategory(categoryEntryId, userId, vote)
    }
    onRefresh()
  }

  const handleAddCategory = async (categoryId: number) => {
    if (type === 'media') {
      await api.addMediaCategory(targetId, categoryId)
    } else {
      await api.addCaseCategory(targetId, categoryId)
    }
    setShowAdd(false)
    onRefresh()
  }

  const existingCategoryIds = categories.map(c => c.category.id)
  const availableCategories = allCategories.filter(c => !existingCategoryIds.includes(c.id))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map(entry => (
          <div
            key={entry.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white border shadow-sm"
            style={{ borderColor: entry.category.color }}
          >
            <Tag size={14} style={{ color: entry.category.color }} />
            <span className="text-slate-800 font-medium">{entry.category.name}</span>
            {entry.source === 'ai' && (
              <span className="text-xs bg-violet-50 text-violet-600 px-1 rounded border border-violet-100">AI</span>
            )}
            <div className="flex items-center gap-1 ml-2 border-l border-slate-200 pl-2">
              <button
                onClick={() => handleVote(entry.id, 1)}
                className="text-slate-400 hover:text-emerald-500 transition"
              >
                <ThumbsUp size={14} />
              </button>
              <span className="text-xs text-slate-600">{entry.upvotes - entry.downvotes}</span>
              <button
                onClick={() => handleVote(entry.id, -1)}
                className="text-slate-400 hover:text-red-500 transition"
              >
                <ThumbsDown size={14} />
              </button>
            </div>
          </div>
        ))}
        
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-sm text-slate-700 transition shadow-sm"
        >
          <Plus size={14} />
          Add
        </button>
      </div>

      {showAdd && availableCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
          {availableCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleAddCategory(cat.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-sm bg-slate-50 hover:bg-slate-100 transition border border-slate-200 text-slate-700"
            >
              <Tag size={12} style={{ color: cat.color }} />
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
