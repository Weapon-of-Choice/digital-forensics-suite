import { useEffect, useState } from 'react'
import { Filter, Calendar, FileText, Image as ImageIcon, MapPin, Search, AlertTriangle, User, Clock } from 'lucide-react'
import { api, TimelineEvent, Case } from '../api'
import { formatDistanceToNow } from 'date-fns'

export default function Timeline() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [cases, setCases] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [timelineData, casesData] = await Promise.all([
          api.getGlobalTimeline(),
          api.getCases()
        ])
        setEvents(timelineData)
        
        const caseMap: Record<number, string> = {}
        casesData.forEach((c: Case) => {
          caseMap[c.id] = c.name
        })
        setCases(caseMap)
      } catch (err) {
        console.error(err)
        setError('Failed to load timeline')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const getIcon = (type: string) => {
    switch (type) {
      case 'media': return <ImageIcon size={16} />
      case 'note': return <FileText size={16} />
      case 'location': return <MapPin size={16} />
      case 'analysis': return <Search size={16} />
      case 'alert': return <AlertTriangle size={16} />
      case 'person': return <User size={16} />
      default: return <Clock size={16} />
    }
  }

  const getColor = (type: string) => {
    switch (type) {
      case 'media': return 'bg-violet-600'
      case 'note': return 'bg-blue-600'
      case 'location': return 'bg-emerald-600'
      case 'analysis': return 'bg-slate-600'
      case 'alert': return 'bg-amber-600'
      default: return 'bg-slate-600'
    }
  }

  if (loading) return <div className="p-8 text-slate-500">Loading timeline...</div>
  if (error) return <div className="p-8 text-red-600">{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Global Timeline</h1>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-md hover:bg-slate-50 transition border border-slate-200 shadow-sm">
            <Filter size={18} />
            Filter
          </button>
          <button className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-md hover:bg-slate-50 transition border border-slate-200 shadow-sm">
            <Calendar size={18} />
            Date Range
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-8 border border-slate-200 shadow-sm">
        {events.length === 0 ? (
          <div className="text-center text-slate-500 py-8">No events found</div>
        ) : (
          <div className="relative border-l-2 border-slate-200 ml-4 space-y-8">
            {events.map((event) => (
              <div key={event.id} className="relative pl-8 group">
                <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${getColor(event.event_type)} border-4 border-white shadow-sm group-hover:scale-125 transition-transform`} />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{event.title}</h3>
                    {cases[event.case_id] && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">
                        {cases[event.case_id]}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                    {event.event_date ? formatDistanceToNow(new Date(event.event_date), { addSuffix: true }) : 'Unknown date'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">{event.description}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded capitalize flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-200`}>
                    {getIcon(event.event_type)}
                    {event.event_type}
                  </span>
                </div>
              </div>
            ))}
            
            <div className="relative pl-8">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-200 border-4 border-white" />
              <p className="text-slate-400 text-sm">End of history</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
