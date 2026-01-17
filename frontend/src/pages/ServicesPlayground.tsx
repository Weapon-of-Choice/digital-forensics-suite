import { useState } from 'react'
import { api } from '../api'
import { Upload, Search, MapPin, Video, Image as ImageIcon, Box, Loader2 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function ServicesPlayground() {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [geoQuery, setGeoQuery] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'face' | 'ai' | 'vsm') => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setLoading(true)
    setResult(null)
    try {
      let data
      if (type === 'face') data = await api.analyzeFace(file)
      if (type === 'ai') data = await api.analyzeCategory(file)
      if (type === 'vsm') data = await api.analyzeVSM(file)
      setResult(data)
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setLoading(false)
  }

  const handleGeocode = async () => {
    if (!geoQuery) return
    setLoading(true)
    setResult(null)
    try {
      const data = await api.analyzeGeocode(geoQuery)
      setResult(data)
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setLoading(false)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6 text-slate-900">Service Playground</h1>
      <p className="text-slate-500 mb-6">Directly test microservices without creating cases.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <Tabs defaultValue="face" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="face" className="flex items-center gap-2"><Box size={16} /> Face</TabsTrigger>
              <TabsTrigger value="ai" className="flex items-center gap-2"><ImageIcon size={16} /> AI</TabsTrigger>
              <TabsTrigger value="vsm" className="flex items-center gap-2"><Video size={16} /> VSM</TabsTrigger>
              <TabsTrigger value="geo" className="flex items-center gap-2"><MapPin size={16} /> Geo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="face">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:bg-slate-50 transition">
                <input type="file" id="face-upload" className="hidden" accept="image/*" onChange={(e) => handleFile(e, 'face')} />
                <label htmlFor="face-upload" className="cursor-pointer flex flex-col items-center">
                  <Box className="w-12 h-12 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-900">Upload Image for Face Detection</span>
                  <span className="text-xs text-slate-500 mt-1">DeepFace / RetinaFace</span>
                </label>
              </div>
            </TabsContent>
            
            <TabsContent value="ai">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:bg-slate-50 transition">
                <input type="file" id="ai-upload" className="hidden" accept="image/*" onChange={(e) => handleFile(e, 'ai')} />
                <label htmlFor="ai-upload" className="cursor-pointer flex flex-col items-center">
                  <ImageIcon className="w-12 h-12 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-900">Upload Image for Categorization</span>
                  <span className="text-xs text-slate-500 mt-1">CLIP Zero-shot</span>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="vsm">
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:bg-slate-50 transition">
                <input type="file" id="vsm-upload" className="hidden" accept="video/*" onChange={(e) => handleFile(e, 'vsm')} />
                <label htmlFor="vsm-upload" className="cursor-pointer flex flex-col items-center">
                  <Video className="w-12 h-12 text-slate-400 mb-2" />
                  <span className="text-sm font-medium text-slate-900">Upload Video for Signature</span>
                  <span className="text-xs text-slate-500 mt-1">Temporal Hashing</span>
                </label>
              </div>
            </TabsContent>

            <TabsContent value="geo">
              <div className="space-y-4">
                <input 
                  type="text" 
                  value={geoQuery}
                  onChange={(e) => setGeoQuery(e.target.value)}
                  placeholder="Enter address or place name..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md"
                />
                <button 
                  onClick={handleGeocode}
                  disabled={!geoQuery}
                  className="w-full bg-violet-600 text-white py-2 rounded-md hover:bg-violet-700 disabled:opacity-50"
                >
                  Geocode
                </button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 text-slate-200 font-mono text-sm overflow-auto max-h-[500px]">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
            <span className="font-bold text-white">JSON Output</span>
            {loading && <Loader2 size={16} className="animate-spin text-violet-400" />}
          </div>
          {result ? (
            <pre>{JSON.stringify(result, null, 2)}</pre>
          ) : (
            <div className="text-slate-600 italic">Waiting for input...</div>
          )}
        </div>
      </div>
    </div>
  )
}
