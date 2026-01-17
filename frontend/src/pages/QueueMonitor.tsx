import { useQuery } from '@tanstack/react-query'
import { api } from '../api'
import { Activity, Clock, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { Skeleton } from '../components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'

export default function QueueMonitor() {
  const { data: queueStatus, isLoading, refetch } = useQuery({
    queryKey: ['queueStatus'],
    queryFn: api.getQueueStatus,
    refetchInterval: 3000,
  })

  const summary = queueStatus?.summary
  const mediaStatus = queueStatus?.media_status

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Processing Queue</h1>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition border border-slate-200 shadow-sm"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Activity className="text-violet-600" size={24} />
                <h2 className="text-lg font-semibold text-slate-900">Celery Workers</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Tasks</span>
                  <span className="text-slate-900 font-semibold">{summary?.active_tasks ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reserved</span>
                  <span className="text-slate-900 font-semibold">{summary?.reserved_tasks ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled</span>
                  <span className="text-slate-900 font-semibold">{summary?.scheduled_tasks ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="text-violet-500" size={24} />
                <h2 className="text-lg font-semibold text-slate-900">Media Status</h2>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Activity size={14} className="text-amber-500" />
                    Processing
                  </span>
                  <span className="text-amber-600 font-semibold">{mediaStatus?.processing ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    Pending
                  </span>
                  <span className="text-slate-900 font-semibold">{mediaStatus?.pending ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-red-500" />
                    Failed
                  </span>
                  <span className="text-red-600 font-semibold">{mediaStatus?.failed ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="text-emerald-500" size={24} />
                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
              </div>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {queueStatus?.failed_tasks?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-start text-sm border-l-2 border-red-500 pl-3">
                      <div className="min-w-0">
                         <span className="text-red-600 font-medium block truncate max-w-[150px]">{item.filename}</span>
                         <span className="text-slate-400 text-xs">Case #{item.case_id}</span>
                      </div>
                      <span className="text-slate-400 text-xs whitespace-nowrap">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                    </div>
                ))}
                {queueStatus?.recent_completed?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-start text-sm border-l-2 border-emerald-500 pl-3">
                      <div className="min-w-0">
                         <span className="text-slate-700 font-medium block truncate max-w-[150px]">{item.filename}</span>
                         <span className="text-slate-400 text-xs">Case #{item.case_id}</span>
                      </div>
                      <span className="text-slate-400 text-xs whitespace-nowrap">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                    </div>
                ))}
                {(!queueStatus?.recent_completed?.length && !queueStatus?.failed_tasks?.length) && (
                   <p className="text-slate-500 text-sm">No recent activity.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Active Tasks</h2>
              {queueStatus?.active_tasks?.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="mx-auto text-slate-400 mb-2" size={32} />
                  <p className="text-slate-500">No active tasks</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queueStatus?.active_tasks?.map((task: any) => (
                    <div key={task.task_id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-violet-600 font-medium text-sm">{task.task_name}</span>
                        <span className="text-slate-400 text-xs">{task.worker}</span>
                      </div>
                      <p className="text-slate-500 text-xs font-mono truncate">
                        ID: {task.task_id}
                      </p>
                      {task.args?.length > 0 && (
                        <p className="text-slate-400 text-xs mt-1">
                          Args: {JSON.stringify(task.args)}
                        </p>
                      )}
                      {task.started && (
                         <p className="text-slate-400 text-xs mt-1">Started: {new Date(task.started * 1000).toLocaleTimeString()}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Reserved Tasks</h2>
              {queueStatus?.reserved_tasks?.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="mx-auto text-slate-400 mb-2" size={32} />
                  <p className="text-slate-500">No reserved tasks</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queueStatus?.reserved_tasks?.map((task: any) => (
                    <div key={task.task_id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-violet-500 font-medium text-sm">{task.task_name}</span>
                        <span className="text-slate-400 text-xs">{task.worker}</span>
                      </div>
                      <p className="text-slate-500 text-xs font-mono truncate">
                        ID: {task.task_id}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
