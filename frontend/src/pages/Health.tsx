import React, { useState, useEffect } from 'react'
import { useQuery } from 'react-query'
import { 
  HardDrive, 
  Cpu, 
  Wifi, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  RefreshCw,
  Database
} from 'lucide-react'
import { healthAPI } from '../services/api'

interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  network_status: string
  uptime: number
  temperature?: number
}

interface RepositoryHealth {
  id: number
  name: string
  path: string
  status: 'healthy' | 'warning' | 'error'
  last_backup: string
  backup_count: number
  total_size: number
  compression_ratio: number
  integrity_check: boolean
  errors: string[]
}

const Health: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds

  // Fetch system health data
  const { 
    data: systemHealth, 
    isLoading: loadingSystem,
    error: systemError,
    refetch: refetchSystem
  } = useQuery<SystemMetrics>({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await healthAPI.getSystemHealth()
      return response.data
    },
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: true
  })

  // Fetch repository health data
  const { 
    data: repositoryHealth, 
    isLoading: loadingRepositories,
    error: repositoryError,
    refetch: refetchRepositories
  } = useQuery<{ repositories: RepositoryHealth[]; status: string }>({
    queryKey: ['repository-health'],
    queryFn: async () => {
      const response = await healthAPI.getRepositoryHealth()
      return response.data
    },
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
    refetchIntervalInBackground: true
  })

  // Auto-refresh toggle effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetchSystem()
        refetchRepositories()
      }, refreshInterval * 1000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, refetchSystem, refetchRepositories])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100'
      case 'warning':
        return 'text-yellow-600 bg-yellow-100'
      case 'error':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const getUsageColor = (usage: number) => {
    if (usage < 70) return 'text-green-600'
    if (usage < 90) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleManualRefresh = () => {
    refetchSystem()
    refetchRepositories()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system and repository health status
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Auto-refresh toggle */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-600">Auto-refresh:</label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
          </div>
          
          {/* Refresh interval */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
            disabled={!autoRefresh}
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>

          {/* Manual refresh button */}
          <button
            onClick={handleManualRefresh}
            disabled={loadingSystem || loadingRepositories}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(loadingSystem || loadingRepositories) ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU Usage */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Cpu className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">CPU Usage</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {loadingSystem ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                    ) : systemHealth?.cpu_usage ? (
                      <span className={getUsageColor(systemHealth.cpu_usage)}>
                        {systemHealth.cpu_usage.toFixed(1)}%
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Database className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Memory Usage</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {loadingSystem ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                    ) : systemHealth?.memory_usage ? (
                      <span className={getUsageColor(systemHealth.memory_usage)}>
                        {systemHealth.memory_usage.toFixed(1)}%
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Disk Usage */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <HardDrive className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Disk Usage</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {loadingSystem ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                    ) : systemHealth?.disk_usage ? (
                      <span className={getUsageColor(systemHealth.disk_usage)}>
                        {systemHealth.disk_usage.toFixed(1)}%
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Network Status */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Wifi className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Network</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {loadingSystem ? (
                      <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                    ) : systemHealth?.network_status ? (
                      <span className="text-green-600">Connected</span>
                    ) : (
                      <span className="text-red-600">Disconnected</span>
                    )}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Details */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Information</h3>
          {loadingSystem ? (
            <div className="space-y-3">
              <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>
              <div className="animate-pulse bg-gray-200 h-4 w-48 rounded"></div>
              <div className="animate-pulse bg-gray-200 h-4 w-40 rounded"></div>
            </div>
          ) : systemError ? (
            <div className="text-red-600">Failed to load system information</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Uptime</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {systemHealth?.uptime ? formatUptime(systemHealth.uptime) : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Temperature</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {systemHealth?.temperature ? `${systemHealth.temperature}°C` : 'N/A'}
                </dd>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Repository Health */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Repository Health</h3>
          {loadingRepositories ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-gray-200 h-20 rounded"></div>
                </div>
              ))}
            </div>
          ) : repositoryError ? (
            <div className="text-red-600">Failed to load repository health information</div>
          ) : repositoryHealth?.repositories?.length === 0 ? (
            <div className="text-gray-500 text-center py-8">No repositories found</div>
          ) : (
            <div className="space-y-4">
              {repositoryHealth?.repositories?.map((repo: RepositoryHealth) => (
                <div key={repo.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(repo.status)}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{repo.name}</h4>
                        <p className="text-sm text-gray-500">{repo.path}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(repo.status)}`}>
                        {repo.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <dt className="text-gray-500">Last Backup</dt>
                      <dd className="font-medium text-gray-900">
                        {repo.last_backup ? new Date(repo.last_backup).toLocaleDateString() : 'Never'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Backup Count</dt>
                      <dd className="font-medium text-gray-900">{repo.backup_count}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Total Size</dt>
                      <dd className="font-medium text-gray-900">{formatBytes(repo.total_size)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Compression</dt>
                      <dd className="font-medium text-gray-900">
                        {repo.compression_ratio ? `${(repo.compression_ratio * 100).toFixed(1)}%` : 'N/A'}
                      </dd>
                    </div>
                  </div>

                  {repo.errors && repo.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <h5 className="text-sm font-medium text-red-800 mb-2">Issues Found:</h5>
                      <ul className="text-sm text-red-700 space-y-1">
                        {repo.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Health Summary */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Health Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                                    {repositoryHealth?.repositories?.filter((repo: RepositoryHealth) => repo.status === 'healthy').length || 0}
              </div>
              <div className="text-sm text-gray-500">Healthy Repositories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                                    {repositoryHealth?.repositories?.filter((repo: RepositoryHealth) => repo.status === 'warning').length || 0}
              </div>
              <div className="text-sm text-gray-500">Warning Repositories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                                    {repositoryHealth?.repositories?.filter((repo: RepositoryHealth) => repo.status === 'error').length || 0}
              </div>
              <div className="text-sm text-gray-500">Error Repositories</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Health 