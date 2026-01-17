import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Map as MapIcon, ExternalLink } from 'lucide-react'

export default function MapView() {
  const [selectedCase, setSelectedCase] = useState<number | undefined>()
  
  const { data: cases } = useQuery({ queryKey: ['cases'], queryFn: api.getCases })

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Map View</h1>
        
        <div className="flex items-center gap-3">
          <a
            href="/osm/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 shadow-sm"
            title="Open standalone OpenStreetMap viewer"
          >
            <ExternalLink size={16} />
            Open in New Tab
          </a>
          
          <select
            value={selectedCase || ''}
            onChange={e => setSelectedCase(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 shadow-sm"
          >
            <option value="">All Cases</option>
            {cases?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 rounded-lg overflow-hidden border border-slate-200 shadow-sm relative bg-slate-100">
        <iframe 
          src="/osm/" 
          className="w-full h-full border-0"
          title="Offline Map Viewer"
        />
      </div>
    </div>
  )
}
