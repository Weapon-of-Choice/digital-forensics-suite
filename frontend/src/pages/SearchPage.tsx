import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Search, Image, Fingerprint, MapPin } from 'lucide-react'

type SearchType = 'similar' | 'signature' | 'location'

export default function SearchPage() {
  const [searchType, setSearchType] = useState<SearchType>('similar')
  const [mediaId, setMediaId] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [radius, setRadius] = useState('10')
  const [results, setResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    setSearching(true)
    try {
      let data: any[]
      switch (searchType) {
        case 'similar':
          data = await api.searchSimilar(Number(mediaId))
          break
        case 'signature':
          data = await api.searchBySignature(Number(mediaId))
          break
        case 'location':
          data = await api.searchByLocation(Number(lat), Number(lon), Number(radius))
          break
        default:
          data = []
      }
      setResults(data)
    } catch (e) {
      console.error(e)
      setResults([])
    }
    setSearching(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-slate-900">Search</h1>

      <div className="bg-white rounded-lg p-6 mb-6 border border-slate-200 shadow-sm">
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSearchType('similar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
              searchType === 'similar' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Image size={18} />
            Similar Images (pHash)
          </button>
          <button
            onClick={() => setSearchType('signature')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
              searchType === 'signature' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Fingerprint size={18} />
            Image Signature (ORB)
          </button>
          <button
            onClick={() => setSearchType('location')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium ${
              searchType === 'location' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <MapPin size={18} />
            Location
          </button>
        </div>

        {(searchType === 'similar' || searchType === 'signature') && (
          <div className="flex gap-4">
            <input
              type="number"
              placeholder="Media ID"
              value={mediaId}
              onChange={e => setMediaId(e.target.value)}
              className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400"
            />
            <button
              onClick={handleSearch}
              disabled={!mediaId || searching}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 px-6 py-2 rounded-md transition shadow-sm"
            >
              <Search size={18} />
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        )}

        {searchType === 'location' && (
          <div className="flex gap-4">
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={lat}
              onChange={e => setLat(e.target.value)}
              className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400"
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={lon}
              onChange={e => setLon(e.target.value)}
              className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400"
            />
            <input
              type="number"
              placeholder="Radius (km)"
              value={radius}
              onChange={e => setRadius(e.target.value)}
              className="w-32 bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400"
            />
            <button
              onClick={handleSearch}
              disabled={!lat || !lon || searching}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 px-6 py-2 rounded-md transition shadow-sm"
            >
              <Search size={18} />
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        )}
      </div>

      {results !== null && (
        <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-slate-900">Results ({results.length})</h2>
          
          {results.length === 0 ? (
            <p className="text-slate-500">No matches found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((r, i) => (
                <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                  <div className="aspect-video bg-slate-200 rounded-md mb-3 overflow-hidden">
                    <img
                      src={api.getMediaThumbnail(r.media_id || r.id)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                  <p className="font-medium text-slate-900">{r.original_filename || `Media #${r.media_id || r.id}`}</p>
                  <p className="text-sm text-slate-500">Case #{r.case_id}</p>
                  {r.distance !== undefined && (
                    <p className="text-xs text-slate-500 mt-1">Distance: {r.distance}</p>
                  )}
                  {r.match_score !== undefined && (
                    <p className="text-xs text-emerald-600 mt-1">Score: {(r.match_score * 100).toFixed(1)}%</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
