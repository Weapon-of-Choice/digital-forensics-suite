import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { api, MapMarker } from '../api'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

L.Marker.prototype.options.icon = defaultIcon

export default function MapView() {
  const [selectedCase, setSelectedCase] = useState<number | undefined>()
  
  const { data: cases } = useQuery({ queryKey: ['cases'], queryFn: api.getCases })
  const { data: markers } = useQuery({ 
    queryKey: ['mapMarkers', selectedCase], 
    queryFn: () => api.getMapMarkers(selectedCase) 
  })

  // Use CartoDB with maxZoom 17 as requested
  const tileUrl = import.meta.env.VITE_TILE_SERVER_URL || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
  const attribution = import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

  const center: [number, number] = markers?.length 
    ? [markers[0].lat, markers[0].lon] 
    : [51.505, -0.09]

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Map View</h1>
        
        <div className="flex items-center gap-3">
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
        <MapContainer center={center} zoom={markers?.length ? 10 : 3} maxZoom={17} className="h-full w-full">
          <TileLayer
            attribution={attribution}
            url={tileUrl}
            maxZoom={17}
          />
          {markers?.map((marker: MapMarker) => (
            <Marker key={marker.media_id} position={[marker.lat, marker.lon]}>
              <Popup>
                <div className="text-slate-900">
                  <p className="font-semibold">{marker.original_filename}</p>
                  <p className="text-sm">Case #{marker.case_id}</p>
                  {marker.capture_date && (
                    <p className="text-xs text-slate-600">
                      {new Date(marker.capture_date).toLocaleString()}
                    </p>
                  )}
                  <p className="text-xs mt-1 font-mono">
                    {marker.lat.toFixed(6)}, {marker.lon.toFixed(6)}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {markers?.length === 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-md border border-slate-200 shadow-sm z-[1000]">
            <p className="text-slate-500 text-sm">No geotagged media found.</p>
          </div>
        )}
      </div>
    </div>
  )
}
