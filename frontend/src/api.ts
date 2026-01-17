import { getAuthHeader } from './lib/keycloak'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized - please login')
    }
    if (res.status === 403) {
      throw new Error('Forbidden - insufficient permissions')
    }
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

export const api = {
  getCases: () => fetchApi<Case[]>('/cases'),
  getCase: (id: number) => fetchApi<CaseDetail>(`/cases/${id}`),
  createCase: (data: { name: string; description?: string }) =>
    fetchApi<Case>('/cases', { method: 'POST', body: JSON.stringify(data) }),
  updateCase: (id: number, data: { name?: string; description?: string }) =>
    fetchApi<Case>(`/cases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCase: (id: number) => fetchApi(`/cases/${id}`, { method: 'DELETE' }),
  
  getCaseMedia: (caseId: number) => fetchApi<Media[]>(`/cases/${caseId}/media`),
  uploadMedia: async (caseId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/cases/${caseId}/media`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeader(),
    })
    if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
    return res.json()
  },
  getMediaFile: (mediaId: number) => `${API_URL}/media/${mediaId}/file`,
  getMediaThumbnail: (mediaId: number) => `${API_URL}/media/${mediaId}/thumbnail`,
  
  getCaseFaces: (caseId: number) => fetchApi<Face[]>(`/cases/${caseId}/faces`),
  searchFaces: (faceId: number, threshold = 0.6) =>
    fetchApi(`/faces/search?face_id=${faceId}&threshold=${threshold}`),
  identifyFace: (faceId: number, name: string) =>
    fetchApi(`/faces/${faceId}/identify?name=${encodeURIComponent(name)}`, { method: 'POST' }),
  
  getMapMarkers: (caseId?: number) =>
    fetchApi<MapMarker[]>(`/map/markers${caseId ? `?case_id=${caseId}` : ''}`),
  
  searchSimilar: (mediaId: number, threshold = 10) =>
    fetchApi(`/search/similar?media_id=${mediaId}&threshold=${threshold}`),
  searchBySignature: (mediaId: number, matchType = 'combined', threshold = 0.7) =>
    fetchApi(`/search/signature?media_id=${mediaId}&match_type=${matchType}&threshold=${threshold}`),
  searchByImage: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`${API_URL}/search/similar/upload`, {
      method: 'POST',
      body: formData,
      headers: getAuthHeader(),
    })
    if (!res.ok) throw new Error('Search failed')
    return res.json()
  },
  searchByLocation: (lat: number, lon: number, radiusKm = 10) =>
    fetchApi(`/search/location?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`),
  
  searchPersons: (query: string) => fetchApi<Person[]>(`/search/autocomplete/persons?q=${encodeURIComponent(query)}`),
  searchCases: (query: string) => fetchApi<Case[]>(`/search/autocomplete/cases?q=${encodeURIComponent(query)}`),

  // Geocoder (Uses external service via Nginx proxy /geocoder)
  geocode: async (query: string) => {
    const res = await fetch(`/geocoder/search?q=${encodeURIComponent(query)}&format=json`)
    if (!res.ok) throw new Error('Geocoding failed')
    return res.json()
  },

  getCategories: () => fetchApi<Category[]>('/categories'),
  createCategory: (data: { name: string; description?: string; color?: string }) =>
    fetchApi<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
  
  getMediaCategories: (mediaId: number) => fetchApi<MediaCategory[]>(`/media/${mediaId}/categories`),
  addMediaCategory: (mediaId: number, categoryId: number) =>
    fetchApi(`/media/${mediaId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ media_id: mediaId, category_id: categoryId, source: 'user' }),
    }),
  voteMediaCategory: (mcId: number, userId: string, vote: 1 | -1) =>
    fetchApi(`/media-categories/${mcId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, vote }),
    }),
  
  getCaseCategories: (caseId: number) => fetchApi<CaseCategory[]>(`/cases/${caseId}/categories`),
  addCaseCategory: (caseId: number, categoryId: number) =>
    fetchApi(`/cases/${caseId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId, category_id: categoryId, source: 'user' }),
    }),
  voteCaseCategory: (ccId: number, userId: string, vote: 1 | -1) =>
    fetchApi(`/case-categories/${ccId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, vote }),
    }),
  
  getCaseReport: (caseId: number) => fetchApi(`/cases/${caseId}/report`),

  // Global Lists
  getGlobalTimeline: () => fetchApi<TimelineEvent[]>('/timeline'),
  getGlobalNotes: () => fetchApi<CaseNote[]>('/notes'),
  getGlobalTasks: (status?: string) => fetchApi<Task[]>(`/tasks${status ? `?status=${status}` : ''}`),
  
  // Tasks
  createTask: (caseId: number, data: { title: string; description?: string; status?: string; priority?: string; due_date?: string; assigned_to?: number }) =>
    fetchApi<Task>(`/cases/${caseId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (taskId: number, data: Partial<Task>) =>
    fetchApi<Task>(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (taskId: number) => fetchApi(`/tasks/${taskId}`, { method: 'DELETE' }),

  // Notes
  createNote: (caseId: number, data: { title: string; content: string; is_pinned?: boolean }) =>
    fetchApi<CaseNote>(`/cases/${caseId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
  updateNote: (noteId: number, data: { title?: string; content?: string; is_pinned?: boolean }) =>
    fetchApi<CaseNote>(`/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteNote: (noteId: number) => fetchApi(`/notes/${noteId}`, { method: 'DELETE' }),

  // Watchlists
  getWatchlists: (activeOnly = false) => fetchApi<Watchlist[]>(`/watchlists${activeOnly ? '?active_only=true' : ''}`),
  getWatchlist: (id: number) => fetchApi<Watchlist>(`/watchlists/${id}`),
  createWatchlist: (data: { name: string; description?: string; alert_on_match?: boolean }) =>
    fetchApi<Watchlist>('/watchlists', { method: 'POST', body: JSON.stringify(data) }),
  updateWatchlist: (id: number, data: { name?: string; description?: string; is_active?: boolean; alert_on_match?: boolean }) =>
    fetchApi<Watchlist>(`/watchlists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWatchlist: (id: number) => fetchApi(`/watchlists/${id}`, { method: 'DELETE' }),
  getWatchlistEntries: (watchlistId: number) => fetchApi<WatchlistEntry[]>(`/watchlists/${watchlistId}/entries`),
  addWatchlistEntry: (watchlistId: number, data: { name?: string; person_id?: number; notes?: string }) =>
    fetchApi<WatchlistEntry>(`/watchlists/${watchlistId}/entries`, { method: 'POST', body: JSON.stringify(data) }),
  deleteWatchlistEntry: (watchlistId: number, entryId: number) =>
    fetchApi(`/watchlists/${watchlistId}/entries/${entryId}`, { method: 'DELETE' }),

  // Alerts
  getAlerts: (caseId?: number, status?: string) => {
    const params = new URLSearchParams()
    if (caseId) params.append('case_id', caseId.toString())
    if (status) params.append('status', status)
    return fetchApi<Alert[]>(`/alerts?${params.toString()}`)
  },
  updateAlert: (alertId: number, status: string) =>
    fetchApi<Alert>(`/alerts/${alertId}`, { method: 'PUT', body: JSON.stringify({ status }) }),

  // Persons
  getPersons: (watchlistOnly = false) => fetchApi<Person[]>(`/persons${watchlistOnly ? '?watchlist_only=true' : ''}`),
  getPerson: (id: number) => fetchApi<Person>(`/persons/${id}`),
  createPerson: (data: { name: string; aliases?: string; description?: string; date_of_birth?: string; nationality?: string; is_watchlist?: boolean; threat_level?: string }) =>
    fetchApi<Person>('/persons', { method: 'POST', body: JSON.stringify(data) }),
  updatePerson: (id: number, data: Partial<Person>) =>
    fetchApi<Person>(`/persons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePerson: (id: number) => fetchApi(`/persons/${id}`, { method: 'DELETE' }),

  // Media
  updateMedia: (mediaId: number, data: { gps_lat?: number; gps_lon?: number; gps_alt?: number; capture_date?: string; notes?: string }) =>
    fetchApi<Media>(`/media/${mediaId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Services Health
  getServicesHealth: () => fetchApi<Record<string, { status: string; code?: number; error?: string }>>('/services/health'),

  // Dashboard Stats
  getDashboardStats: () => fetchApi<DashboardStats>('/stats/dashboard'),

  // Queue Status
  getQueueStatus: () => fetchApi<QueueStatus>('/tasks/queue-status'),

  // Task Triggers
  triggerProcessMedia: (mediaId: number) =>
    fetchApi(`/tasks/process-media/${mediaId}`, { method: 'POST' }),
  triggerBatchProcess: (caseId: number) =>
    fetchApi(`/tasks/batch-process?case_id=${caseId}`, { method: 'POST' }),
  triggerRecategorize: (caseId: number) =>
    fetchApi(`/tasks/recategorize-case/${caseId}`, { method: 'POST' }),
}

export interface TimelineEvent {
  id: number
  case_id: number
  title: string
  description?: string
  event_date?: string
  event_type: string
  created_at: string
}

export interface CaseNote {
  id: number
  case_id: number
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  user_id?: number
}

export interface Task {
  id: number
  case_id: number
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string
  assigned_to?: number
  created_at: string
  completed_at?: string
}

export interface Watchlist {
  id: number
  name: string
  description?: string
  is_active: boolean
  alert_on_match: boolean
  created_at: string
}

export interface WatchlistEntry {
  id: number
  watchlist_id: number
  person_id?: number
  name?: string
  notes?: string
  created_at: string
}

export interface Alert {
  id: number
  case_id?: number
  type: string
  severity: string
  message: string
  status: string
  created_at: string
  details?: any
}

export interface Person {
  id: number
  name: string
  aliases?: string
  description?: string
  date_of_birth?: string
  nationality?: string
  is_watchlist: boolean
  threat_level?: string
  created_at: string
}

export interface Case {
  id: number
  name: string
  description?: string
  created_at: string
}

export interface CaseDetail extends Case {
  media_count?: number
  face_count?: number
}

export interface Media {
  id: number
  case_id: number
  original_filename: string
  status: string
  file_size: number
  mime_type?: string
  gps_lat?: number
  gps_lon?: number
  capture_date?: string
  created_at: string
  video_signature?: {
    id: number
    temporal_signature?: string
    audio_fingerprint?: string
    created_at: string
  }
  image_signature?: {
    id: number
    created_at: string
  }
}

export interface Face {
  id: number
  media_id: number
  top: number
  right: number
  bottom: number
  left: number
  identity?: string
  confidence?: number
  thumbnail_path?: string
}

export interface MapMarker {
  media_id: number
  case_id: number
  lat: number
  lon: number
  thumbnail_path?: string
  original_filename: string
  capture_date?: string
}

export interface Category {
  id: number
  name: string
  description?: string
  color?: string
  is_system: boolean
}

export interface MediaCategory {
  id: number
  media_id: number
  category: Category
  source: string
  confidence?: number
  upvotes: number
  downvotes: number
  score: number
}

export interface CaseCategory {
  id: number
  case_id: number
  category: Category
  source: string
  upvotes: number
  downvotes: number
  score: number
}

export interface DashboardStats {
  total_cases: number
  total_media: number
  total_faces: number
  media_with_gps: number
  processing_media: number
  pending_media: number
  completed_media: number
  failed_media: number
}

export interface QueueStatus {
  summary: {
    active_tasks: number
    reserved_tasks: number
    scheduled_tasks: number
  }
  media_status: {
    processing: number
    pending: number
    failed: number
  }
  active_tasks: Array<{
    worker: string
    task_name: string
    task_id: string
    args: any[]
    started?: number
  }>
  reserved_tasks: Array<{
    worker: string
    task_name: string
    task_id: string
    args: any[]
  }>
  recent_completed: Array<{
    id: number
    filename: string
    case_id: number
  }>
}
