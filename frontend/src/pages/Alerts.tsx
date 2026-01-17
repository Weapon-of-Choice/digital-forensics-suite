import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, AlertTriangle, Info, CheckCircle, X, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { api, Alert } from '../api'
import { Skeleton } from '../components/ui/skeleton'

type StatusFilter = 'all' | 'active' | 'dismissed' | 'resolved'

export default function Alerts() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ['alerts', statusFilter === 'all' ? undefined : statusFilter],
    queryFn: () => api.getAlerts(undefined, statusFilter === 'all' ? undefined : statusFilter),
  })

  const updateMutation = useMutation({
    mutationFn: ({ alertId, status }: { alertId: number; status: string }) =>
      api.updateAlert(alertId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const handleDismiss = (alertId: number) => {
    updateMutation.mutate({ alertId, status: 'dismissed' })
  }

  const handleResolve = (alertId: number) => {
    updateMutation.mutate({ alertId, status: 'resolved' })
  }

  const handleMarkAllRead = () => {
    const activeAlerts = alerts.filter((a: Alert) => a.status === 'active')
    activeAlerts.forEach((alert: Alert) => {
      updateMutation.mutate({ alertId: alert.id, status: 'dismissed' })
    })
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="text-red-500" size={20} />
      case 'warning':
        return <Bell className="text-amber-500" size={20} />
      case 'info':
        return <Info className="text-violet-500" size={20} />
      default:
        return <Bell className="text-slate-400" size={20} />
    }
  }

  const getSeverityDot = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500'
      case 'warning':
        return 'bg-amber-500'
      case 'info':
        return 'bg-violet-500'
      default:
        return 'bg-slate-400'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-50 text-blue-600 border-blue-200'
      case 'dismissed':
        return 'bg-slate-100 text-slate-500 border-slate-200'
      case 'resolved':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200'
      default:
        return 'bg-slate-100 text-slate-500 border-slate-200'
    }
  }

  // Sort alerts: active first, then by created_at desc
  const sortedAlerts = [...alerts].sort((a: Alert, b: Alert) => {
    if (a.status === 'active' && b.status !== 'active') return -1
    if (a.status !== 'active' && b.status === 'active') return 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const activeCount = alerts.filter((a: Alert) => a.status === 'active').length

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        Failed to load alerts. Please try again.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">System Alerts</h1>
          {!isLoading && activeCount > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-1 rounded-full">
              {activeCount} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {(['all', 'active', 'dismissed', 'resolved'] as StatusFilter[]).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                  statusFilter === status
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          {!isLoading && activeCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-slate-500 hover:text-slate-900 transition"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
           <Skeleton className="h-20 w-full" />
           <Skeleton className="h-20 w-full" />
           <Skeleton className="h-20 w-full" />
        </div>
      ) : sortedAlerts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-sm">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No alerts</h3>
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? 'No system alerts at the moment. All clear!'
              : `No ${statusFilter} alerts.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg overflow-hidden border border-slate-200 shadow-sm">
          {sortedAlerts.map((alert: Alert) => (
            <div
              key={alert.id}
              className={`p-4 border-b border-slate-100 flex gap-4 hover:bg-slate-50 transition relative group ${
                alert.status !== 'active' ? 'opacity-60' : ''
              }`}
            >
              <div
                className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${getSeverityDot(alert.severity)}`}
              />

              <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(alert.severity)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border font-medium ${getStatusBadge(
                          alert.status
                        )}`}
                      >
                        {alert.status}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">{alert.type}</span>
                    </div>
                    <p className="text-slate-600 text-sm">{alert.message}</p>
                    {alert.case_id && (
                      <span className="text-xs text-slate-400 mt-1 inline-block">
                        Case #{alert.case_id}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              {alert.status === 'active' && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleResolve(alert.id)}
                    disabled={updateMutation.isPending}
                    className="p-2 text-slate-400 hover:text-emerald-600 transition"
                    title="Mark as resolved"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    disabled={updateMutation.isPending}
                    className="p-2 text-slate-400 hover:text-slate-600 transition"
                    title="Dismiss"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary stats - only show if not loading */}
      {!isLoading && alerts.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertTriangle className="text-red-500" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {alerts.filter((a: Alert) => a.severity === 'critical').length}
                </p>
                <p className="text-xs text-slate-500">Critical</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Bell className="text-amber-500" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {alerts.filter((a: Alert) => a.severity === 'warning').length}
                </p>
                <p className="text-xs text-slate-500">Warnings</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-lg">
                <Info className="text-violet-500" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {alerts.filter((a: Alert) => a.severity === 'info').length}
                </p>
                <p className="text-xs text-slate-500">Info</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
