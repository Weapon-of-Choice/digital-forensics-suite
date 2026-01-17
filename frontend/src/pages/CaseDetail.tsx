import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Media, Face, Category } from '../api'
import { Upload, Image, Users, Tag, MapPin, Edit2, Save, Loader2, Video, Search, FileJson, UserCheck } from 'lucide-react'
import CategoryVoting from '../components/CategoryVoting'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'

export default function CaseDetail() {
  const { id } = useParams<{ id: string }>()
  const caseId = Number(id)
  const queryClient = useQueryClient()
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editLat, setEditLat] = useState('')
  const [editLon, setEditLon] = useState('')
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState<any[]>([])

  const [showEditCaseModal, setShowEditCaseModal] = useState(false)
  const [editCaseName, setEditCaseName] = useState('')
  const [editCaseDesc, setEditCaseDesc] = useState('')

  const [showIdentifyModal, setShowIdentifyModal] = useState(false)
  const [selectedFace, setSelectedFace] = useState<Face | null>(null)
  const [identifyName, setIdentifyName] = useState('')

  const { data: caseData } = useQuery({ queryKey: ['case', caseId], queryFn: () => api.getCase(caseId) })
  const { data: media } = useQuery({ queryKey: ['caseMedia', caseId], queryFn: () => api.getCaseMedia(caseId) })
  const { data: faces } = useQuery({ queryKey: ['caseFaces', caseId], queryFn: () => api.getCaseFaces(caseId) })
  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: api.getCategories })
  const { data: caseCategories } = useQuery({ 
    queryKey: ['caseCategories', caseId], 
    queryFn: () => api.getCaseCategories(caseId) 
  })
  
  const { data: mediaCategories } = useQuery({
    queryKey: ['mediaCategories', selectedMedia?.id],
    queryFn: () => selectedMedia ? api.getMediaCategories(selectedMedia.id) : Promise.resolve([]),
    enabled: !!selectedMedia
  })

  const updateMediaMutation = useMutation({
    mutationFn: ({ mediaId, data }: { mediaId: number; data: { gps_lat?: number; gps_lon?: number } }) =>
      api.updateMedia(mediaId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseMedia', caseId] })
      setEditing(false)
    },
  })

  const updateCaseMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string }) => api.updateCase(caseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      setShowEditCaseModal(false)
    }
  })

  const identifyFaceMutation = useMutation({
    mutationFn: ({ faceId, name }: { faceId: number; name: string }) => api.identifyFace(faceId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseFaces', caseId] })
      setShowIdentifyModal(false)
      setIdentifyName('')
    }
  })

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    setUploading(true)
    for (const file of Array.from(files)) {
      await api.uploadMedia(caseId, file)
    }
    queryClient.invalidateQueries({ queryKey: ['caseMedia', caseId] })
    queryClient.invalidateQueries({ queryKey: ['caseFaces', caseId] })
    setUploading(false)
  }, [caseId, queryClient])

  const openMediaModal = (m: Media) => {
    setSelectedMedia(m)
    setEditLat(m.gps_lat?.toString() || '')
    setEditLon(m.gps_lon?.toString() || '')
    setGeoQuery('')
    setGeoResults([])
    setEditing(false)
  }

  const handleSaveLocation = () => {
    if (!selectedMedia) return
    const lat = editLat ? parseFloat(editLat) : undefined
    const lon = editLon ? parseFloat(editLon) : undefined
    updateMediaMutation.mutate({ mediaId: selectedMedia.id, data: { gps_lat: lat, gps_lon: lon } })
    setSelectedMedia({ ...selectedMedia, gps_lat: lat, gps_lon: lon })
  }

  const handleGeocode = async () => {
    if (!geoQuery) return
    try {
      const results = await api.geocode(geoQuery)
      setGeoResults(results)
    } catch (e) {
      console.error(e)
    }
  }

  const selectGeoResult = (lat: string, lon: string) => {
    setEditLat(lat)
    setEditLon(lon)
    setGeoResults([])
    setGeoQuery('')
  }

  const openEditCase = () => {
    if (!caseData) return
    setEditCaseName(caseData.name)
    setEditCaseDesc(caseData.description || '')
    setShowEditCaseModal(true)
  }

  const handleSaveCase = () => {
    if (!editCaseName.trim()) return
    updateCaseMutation.mutate({ name: editCaseName, description: editCaseDesc })
  }

  const openIdentifyModal = (face: Face) => {
    setSelectedFace(face)
    setIdentifyName(face.identity || '')
    setShowIdentifyModal(true)
  }

  const handleIdentify = () => {
    if (!selectedFace || !identifyName.trim()) return
    identifyFaceMutation.mutate({ faceId: selectedFace.id, name: identifyName.trim() })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            {caseData?.name}
            <button onClick={openEditCase} className="text-slate-400 hover:text-violet-600 transition p-1">
              <Edit2 size={18} />
            </button>
          </h1>
          <p className="text-slate-500">{caseData?.description}</p>
        </div>
        <label className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-medium px-4 py-2 rounded-md cursor-pointer transition shadow-sm">
          <Upload size={20} />
          {uploading ? 'Uploading...' : 'Upload Media'}
          <input type="file" multiple accept="image/*,video/*" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-900">
          <Tag size={20} />
          Case Categories
        </h2>
        <CategoryVoting
          type="case"
          targetId={caseId}
          categories={caseCategories || []}
          allCategories={categories || []}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['caseCategories', caseId] })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-900">
            <Image size={20} />
            Media ({media?.length || 0})
          </h2>
          
          {media?.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center shadow-sm">
              <Image size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500">No media uploaded yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {media?.map(m => (
                <div
                  key={m.id}
                  onClick={() => openMediaModal(m)}
                  className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-violet-500 transition border border-slate-200 shadow-sm"
                >
                  <img
                    src={api.getMediaThumbnail(m.id)}
                    alt={m.original_filename}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = api.getMediaFile(m.id) }}
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-800/90 to-transparent p-2 pt-8">
                    <p className="text-xs truncate text-white">{m.original_filename}</p>
                    <div className="flex gap-1 mt-1">
                      {m.status === 'processing' && (
                        <span className="text-xs bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">Processing</span>
                      )}
                      {m.gps_lat && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">GPS</span>
                      )}
                      {m.video_signature && (
                        <span className="text-xs bg-blue-500/20 text-blue-500 px-1.5 py-0.5 rounded border border-blue-500/20">VSM</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-slate-900">
            <Users size={20} />
            Faces ({faces?.length || 0})
          </h2>
          
          {faces?.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm">
              <Users size={32} className="mx-auto text-slate-400 mb-2" />
              <p className="text-slate-500 text-sm">No faces detected yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto shadow-sm">
              {faces?.map(face => (
                <div key={face.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-md border border-slate-100 group">
                  <div className="w-12 h-12 bg-slate-200 rounded-md overflow-hidden shrink-0">
                    {face.thumbnail_path && (
                      <img
                        src={`http://localhost:8000${face.thumbnail_path}`}
                        alt="Face"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{face.identity || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">Media #{face.media_id}</p>
                  </div>
                  <button 
                    onClick={() => openIdentifyModal(face)}
                    className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition"
                    title="Identify Person"
                  >
                    <UserCheck size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Media Modal */}
      <Dialog open={!!selectedMedia} onOpenChange={(open) => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          {selectedMedia && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMedia.original_filename}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                {selectedMedia.mime_type?.startsWith('video/') ? (
                  <video
                    src={api.getMediaFile(selectedMedia.id)}
                    controls
                    className="max-w-full max-h-[60vh] mx-auto rounded-md border border-slate-200 shadow-sm"
                  />
                ) : (
                  <img
                    src={api.getMediaFile(selectedMedia.id)}
                    alt={selectedMedia.original_filename}
                    className="max-w-full max-h-[60vh] mx-auto rounded-md border border-slate-200 shadow-sm"
                  />
                )}
                
                {/* Geolocation Section */}
                <div className="mt-6 bg-slate-50 p-4 rounded-md border border-slate-200">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-slate-900 flex items-center gap-2">
                      <MapPin size={16} />
                      Location Data
                    </h4>
                    {!editing ? (
                      <button
                        onClick={() => setEditing(true)}
                        className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1"
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveLocation}
                        disabled={updateMediaMutation.isPending}
                        className="text-sm bg-violet-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-violet-700 disabled:opacity-50"
                      >
                        {updateMediaMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        Save
                      </button>
                    )}
                  </div>
                  
                  {editing ? (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={geoQuery}
                          onChange={(e) => setGeoQuery(e.target.value)}
                          placeholder="Search address..."
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm"
                          onKeyDown={(e) => e.key === 'Enter' && handleGeocode()}
                        />
                        <button 
                          onClick={handleGeocode}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded-md"
                        >
                          <Search size={16} />
                        </button>
                      </div>
                      
                      {geoResults.length > 0 && (
                        <ul className="bg-white border border-slate-200 rounded-md max-h-40 overflow-y-auto text-sm">
                          {geoResults.map((res, idx) => (
                            <li 
                              key={idx} 
                              className="px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                              onClick={() => selectGeoResult(res.lat, res.lon)}
                            >
                              {res.display_name}
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Latitude</label>
                          <input
                            type="number"
                            step="any"
                            value={editLat}
                            onChange={(e) => setEditLat(e.target.value)}
                            placeholder="e.g. 51.5074"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Longitude</label>
                          <input
                            type="number"
                            step="any"
                            value={editLon}
                            onChange={(e) => setEditLon(e.target.value)}
                            placeholder="e.g. -0.1278"
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 mb-1">Latitude</p>
                        <p className="text-slate-900 font-mono">{selectedMedia.gps_lat?.toFixed(6) || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Longitude</p>
                        <p className="text-slate-900 font-mono">{selectedMedia.gps_lon?.toFixed(6) || 'Not set'}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Media Categories */}
                <div className="mt-6 border-t border-slate-200 pt-4">
                  <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                    <Tag size={16} /> Categories
                  </h4>
                  <CategoryVoting
                    type="media"
                    targetId={selectedMedia.id}
                    categories={mediaCategories || []}
                    allCategories={categories || []}
                    onRefresh={() => queryClient.invalidateQueries({ queryKey: ['mediaCategories', selectedMedia.id] })}
                  />
                </div>

                {/* Signatures & Analysis */}
                {(selectedMedia.video_signature || selectedMedia.image_signature) && (
                  <div className="mt-6 border-t border-slate-200 pt-4">
                    <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2">
                      <FileJson size={16} /> Analysis Data
                    </h4>
                    <div className="space-y-3">
                      {selectedMedia.video_signature && (
                        <div className="bg-slate-50 p-3 rounded border border-slate-100 text-sm">
                          <p className="font-semibold text-violet-700 flex items-center gap-1 mb-1">
                            <Video size={14} /> Video Signature (VSM)
                          </p>
                          <p className="font-mono text-xs text-slate-600 break-all">
                            Temporal: {selectedMedia.video_signature.temporal_signature || 'N/A'}
                          </p>
                          {selectedMedia.video_signature.audio_fingerprint && (
                            <p className="font-mono text-xs text-slate-600 mt-1 break-all">
                              Audio: {selectedMedia.video_signature.audio_fingerprint.substring(0, 32)}...
                            </p>
                          )}
                        </div>
                      )}
                      {selectedMedia.image_signature && (
                        <div className="bg-slate-50 p-3 rounded border border-slate-100 text-sm">
                          <p className="font-semibold text-emerald-700 flex items-center gap-1 mb-1">
                            <Image size={14} /> Image Signature
                          </p>
                          <p className="text-xs text-slate-500">ORB Descriptors & Colour Histogram extracted.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 mb-1">Status</p>
                    <p className="text-slate-900 font-medium capitalize">{selectedMedia.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Size</p>
                    <p className="text-slate-900 font-medium">{(selectedMedia.file_size / 1024).toFixed(1)} KB</p>
                  </div>
                  {selectedMedia.capture_date && (
                    <div>
                      <p className="text-slate-500 mb-1">Capture Date</p>
                      <p className="text-slate-900 font-medium">{new Date(selectedMedia.capture_date).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Case Modal */}
      <Dialog open={showEditCaseModal} onOpenChange={setShowEditCaseModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Case</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input type="text" value={editCaseName} onChange={(e) => setEditCaseName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={editCaseDesc} onChange={(e) => setEditCaseDesc(e.target.value)} rows={3} className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowEditCaseModal(false)} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium">Cancel</button>
            <button onClick={handleSaveCase} disabled={!editCaseName.trim() || updateCaseMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
              {updateCaseMutation.isPending && <Loader2 size={16} className="animate-spin" />} Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Identify Face Modal */}
      <Dialog open={showIdentifyModal} onOpenChange={setShowIdentifyModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Identify Face</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              {selectedFace?.thumbnail_path && (
                <img src={`http://localhost:8000${selectedFace.thumbnail_path}`} className="w-24 h-24 rounded-lg object-cover bg-slate-200" alt="Face" />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Person Name *</label>
              <input 
                type="text" 
                value={identifyName} 
                onChange={(e) => setIdentifyName(e.target.value)} 
                placeholder="Enter name..." 
                className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-900" 
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowIdentifyModal(false)} className="px-4 py-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium">Cancel</button>
            <button onClick={handleIdentify} disabled={!identifyName.trim() || identifyFaceMutation.isPending} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
              {identifyFaceMutation.isPending && <Loader2 size={16} className="animate-spin" />} Identify
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
