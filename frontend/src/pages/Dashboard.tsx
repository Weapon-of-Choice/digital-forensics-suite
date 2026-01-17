import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { FolderOpen, Image, MapPin, Users, Loader2, AlertTriangle, CheckCircle, ArrowRight, Zap, Server, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Skeleton } from '../components/ui/skeleton'

function HeroBanner() {
  return (
    <div className="relative overflow-hidden bg-white border border-slate-200 px-6 py-12 shadow-sm rounded-2xl mb-8 lg:px-12">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-slate-500 font-medium text-sm">Forensic Platform</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Advanced Media Analysis for Investigations
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-500">
            Process digital evidence with AI-powered face recognition, geolocation mapping, and intelligent categorization.
          </p>
          <div className="mt-6 flex items-center gap-4">
            <Link
              to="/cases"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition"
            >
              Create New Case
            </Link>
            <Link to="/search" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition flex items-center gap-1">
              Search Media <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-xl font-semibold text-slate-900">AI</div>
            <div className="text-sm text-slate-500">Analysis</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-xl font-semibold text-slate-900">GPS</div>
            <div className="text-sm text-slate-500">Mapping</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-xl font-semibold text-slate-900">Face</div>
            <div className="text-sm text-slate-500">Recognition</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="text-xl font-semibold text-slate-900">Hash</div>
            <div className="text-sm text-slate-500">Signatures</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceStatus() {
  const { data: services, isLoading, error } = useQuery({
    queryKey: ['servicesHealth'],
    queryFn: api.getServicesHealth,
    refetchInterval: 30000,
  })

  const getStatusIcon = (status: string) => {
    if (status === 'healthy') return <CheckCircle size={16} className="text-emerald-500" />
    if (status === 'unhealthy') return <AlertTriangle size={16} className="text-amber-500" />
    return <XCircle size={16} className="text-red-500" />
  }

  const getStatusColor = (status: string) => {
    if (status === 'healthy') return 'bg-emerald-50 border-emerald-200 text-emerald-700'
    if (status === 'unhealthy') return 'bg-amber-50 border-amber-200 text-amber-700'
    return 'bg-red-50 border-red-200 text-red-700'
  }

  if (isLoading) return (
      <div className="flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
      </div>
  )
  
  if (error || !services) return <div className="text-red-500 text-sm">Failed to load service status</div>

  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(services).map(([name, info]) => (
        <div key={name} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${getStatusColor(info.status)}`}>
          {getStatusIcon(info.status)}
          <span className="font-medium">{name}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { data: cases } = useQuery({ queryKey: ['cases'], queryFn: api.getCases })
  const { data: stats, isLoading } = useQuery({ queryKey: ['dashboardStats'], queryFn: api.getDashboardStats })

  const statCards = [
    { label: 'Total Cases', value: stats?.total_cases ?? 0, icon: FolderOpen, color: 'bg-slate-900 text-white' },
    { label: 'Total Media', value: stats?.total_media ?? 0, icon: Image, color: 'bg-slate-100 text-slate-700' },
    { label: 'GPS Locations', value: stats?.media_with_gps ?? 0, icon: MapPin, color: 'bg-emerald-600 text-white' },
    { label: 'Faces Detected', value: stats?.total_faces ?? 0, icon: Users, color: 'bg-amber-500 text-white' },
  ]

  const processingStats = [
    { label: 'Processing', value: stats?.processing_media ?? 0, icon: Loader2, color: 'text-amber-500' },
    { label: 'Completed', value: stats?.completed_media ?? 0, icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Failed', value: stats?.failed_media ?? 0, icon: AlertTriangle, color: 'text-red-500' },
  ]

  return (
    <div>
      <HeroBanner />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-lg shadow-sm p-5 flex items-center gap-4 border border-slate-200">
                <div className={`${color} p-3 rounded-lg`}>
                <Icon size={22} />
                </div>
                <div>
                <p className="text-slate-500 text-sm font-medium">{label}</p>
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
                </div>
            </div>
            ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">Processing Status</h2>
            <Link to="/queue" className="text-slate-600 hover:text-slate-900 text-sm font-medium">
              View Queue →
            </Link>
          </div>
          {isLoading ? (
             <div className="flex gap-6">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-24" />
             </div>
          ) : (
            <div className="flex gap-6">
                {processingStats.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="flex items-center gap-2">
                    <Icon size={18} className={color} />
                    <span className="text-slate-500 text-sm">{label}:</span>
                    <span className="text-slate-900 font-semibold">{value}</span>
                </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5 border border-slate-200">
          <h2 className="text-base font-semibold mb-4 text-slate-900">Quick Actions</h2>
          <div className="flex gap-3">
            <Link to="/cases" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-sm transition">
              New Case
            </Link>
            <Link to="/map" className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition border border-slate-200">
              View Map
            </Link>
            <Link to="/search" className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition border border-slate-200">
              Search Media
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5 border border-slate-200 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Server size={18} className="text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">Service Health</h2>
        </div>
        <ServiceStatus />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5 border border-slate-200">
        <h2 className="text-base font-semibold mb-4 text-slate-900">Recent Cases</h2>
        {isLoading ? (
             <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
             </div>
        ) : cases?.length === 0 ? (
          <p className="text-slate-500 text-sm">No cases yet. Create one to get started.</p>
        ) : (
          <div className="space-y-2">
            {cases?.slice(0, 5).map(c => (
              <Link 
                key={c.id} 
                to={`/cases/${c.id}`}
                className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition border border-slate-200 hover:border-slate-300"
              >
                <div>
                  <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.description || 'No description'}</p>
                </div>
                <span className="text-sm text-slate-400">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
