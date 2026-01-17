import { useState } from 'react'
import { api } from '../../api'
import { Search, Image, Fingerprint, MapPin, Type, FolderOpen, User, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'

type SearchType = 'text' | 'similar' | 'signature' | 'location' | 'upload'

export default function SearchContent({ onResultClick }: { onResultClick?: () => void }) {
  const [searchType, setSearchType] = useState<SearchType>('text')
  const [textQuery, setTextQuery] = useState('')
  const [mediaId, setMediaId] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [radius, setRadius] = useState('10')
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<any[] | null>(null)
  const [searching, setSearching] = useState(false)

  const handleSearch = async () => {
    setSearching(true)
    try {
      let data: any[] = []
      switch (searchType) {
        case 'text':
          if (!textQuery.trim()) break
          const [cases, persons] = await Promise.all([
            api.searchCases(textQuery),
            api.searchPersons(textQuery)
          ])
          data = [
            ...cases.map(c => ({ ...c, resultType: 'case' })),
            ...persons.map(p => ({ ...p, resultType: 'person' }))
          ]
          break
        case 'similar':
          data = await api.searchSimilar(Number(mediaId))
          break
        case 'signature':
          data = await api.searchBySignature(Number(mediaId))
          break
        case 'location':
          data = await api.searchByLocation(Number(lat), Number(lon), Number(radius))
          break
        case 'upload':
          if (!file) break
          data = await api.searchByImage(file)
          break
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
      <div className="bg-white rounded-lg p-6 mb-6 border border-slate-200 shadow-sm">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSearchType('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium whitespace-nowrap ${
              searchType === 'text' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Type size={18} />
            Text Search
          </button>
          <button
            onClick={() => setSearchType('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium whitespace-nowrap ${
              searchType === 'upload' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Upload size={18} />
            Image Upload
          </button>
          <button
            onClick={() => setSearchType('similar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium whitespace-nowrap ${
              searchType === 'similar' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Image size={18} />
            Media ID
          </button>
          <button
            onClick={() => setSearchType('signature')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium whitespace-nowrap ${
              searchType === 'signature' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <Fingerprint size={18} />
            Signature
          </button>
          <button
            onClick={() => setSearchType('location')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition font-medium whitespace-nowrap ${
              searchType === 'location' 
                ? 'bg-violet-600 text-white shadow-sm' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <MapPin size={18} />
            Location
          </button>
        </div>

        {searchType === 'text' && (
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search cases, persons, media..."
              value={textQuery}
              onChange={e => setTextQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder-slate-400"
            />
            <button
              onClick={handleSearch}
              disabled={!textQuery.trim() || searching}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 px-6 py-2 rounded-md transition shadow-sm"
            >
              <Search size={18} />
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        )}

        {searchType === 'upload' && (
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Upload image to search similar media</label>
              <input
                type="file"
                accept="image/*"
                onChange={e => setFile(e.target.files ? e.target.files[0] : null)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
            </div>
            <div className="self-end">
              <button
                onClick={handleSearch}
                disabled={!file || searching}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50 px-6 py-2 rounded-md transition shadow-sm"
              >
                <Search size={18} />
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        )}

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
              {results.map((r, i) => {
                // Render Case result
                if (r.resultType === 'case') {
                  return (
                    <Link onClick={onResultClick} key={i} to={`/cases/${r.id}`} className="bg-slate-50 hover:bg-slate-100 rounded-lg p-4 border border-slate-200 transition group">
                      <div className="flex items-center gap-2 mb-2 text-violet-600">
                        <FolderOpen size={20} />
                        <span className="font-semibold text-sm uppercase">Case</span>
                      </div>
                      <p className="font-medium text-slate-900 group-hover:text-violet-600">{r.name}</p>
                      <p className="text-sm text-slate-500 line-clamp-2">{r.description}</p>
                    </Link>
                  )
                }
                // Render Person result
                if (r.resultType === 'person') {
                  return (
                    <div key={i} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2 text-amber-600">
                        <User size={20} />
                        <span className="font-semibold text-sm uppercase">Person</span>
                      </div>
                      <p className="font-medium text-slate-900">{r.name}</p>
                      {r.aliases && <p className="text-xs text-slate-500">AKA: {r.aliases}</p>}
                    </div>
                  )
                }
                // Render Media result (existing)
                return (
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
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
