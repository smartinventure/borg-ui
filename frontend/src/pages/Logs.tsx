import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  CheckCircle,
  BarChart3
} from 'lucide-react';
import { logsAPI } from '../services/api';
import { toast } from 'react-hot-toast';

const Logs: React.FC = () => {
  const [selectedLogType, setSelectedLogType] = useState('borgmatic');
  const [lines, setLines] = useState(100);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const queryClient = useQueryClient();

  // Fetch log types
  const { data: logTypes } = useQuery({
    queryKey: ['logTypes'],
    queryFn: logsAPI.getLogTypes,
  });

  // Fetch logs
  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['logs', selectedLogType, lines, searchTerm, levelFilter, startTime, endTime],
    queryFn: () => logsAPI.getLogs({
      log_type: selectedLogType,
      lines,
      search: searchTerm || undefined,
      level: levelFilter || undefined,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
    }),
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  });

  // Fetch log statistics
  const { data: statsData } = useQuery({
    queryKey: ['logStats', selectedLogType],
    queryFn: () => logsAPI.getLogStats({
      log_type: selectedLogType,
      hours: 24,
    }),
  });

  // Clear logs mutation
  const clearLogsMutation = useMutation({
    mutationFn: logsAPI.clearLogs,
    onSuccess: () => {
      toast.success('Logs cleared successfully');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['logStats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to clear logs');
    },
  });

  // Download logs
  const downloadLogs = () => {
    if (!logsData?.data?.logs) return;
    
    const content = logsData.data.logs.join('');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedLogType}_logs_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get level icon
  const getLevelIcon = (level: string) => {
    const levelLower = level.toLowerCase();
    if (levelLower.includes('error')) return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (levelLower.includes('warning')) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    if (levelLower.includes('info')) return <Info className="w-4 h-4 text-blue-500" />;
    if (levelLower.includes('success')) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return <Info className="w-4 h-4 text-gray-500" />;
  };

  // Get level color
  const getLevelColor = (level: string) => {
    const levelLower = level.toLowerCase();
    if (levelLower.includes('error')) return 'text-red-600 bg-red-50';
    if (levelLower.includes('warning')) return 'text-yellow-600 bg-yellow-50';
    if (levelLower.includes('info')) return 'text-blue-600 bg-blue-50';
    if (levelLower.includes('success')) return 'text-green-600 bg-green-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-gray-600">Monitor and analyze system and backup logs</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => refetch()}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={downloadLogs}
            className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {statsData?.data?.stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Total Entries</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{statsData.data.stats.total_entries}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Errors</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{statsData.data.stats.error_count}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Warnings</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600">{statsData.data.stats.warning_count}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center">
              <Info className="w-5 h-5 text-blue-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Info</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{statsData.data.stats.info_count}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="ml-2 text-sm font-medium text-gray-600">Success Rate</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{statsData.data.stats.success_rate.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            {/* Log Type Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Log Type</label>
              <select
                value={selectedLogType}
                onChange={(e) => setSelectedLogType(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {logTypes?.data?.log_types?.map((type: any) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lines Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lines</label>
              <select
                value={lines}
                onChange={(e) => setLines(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={-1}>All</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>

            {/* Auto Refresh */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Auto</span>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Level Filter</label>
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auto Refresh Interval (s)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logs Display */}
      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">
              {logTypes?.data?.log_types?.find((t: any) => t.id === selectedLogType)?.name || 'Logs'}
            </h3>
            {logsData?.data?.total_lines && (
              <span className="text-sm text-gray-500">
                ({logsData.data.total_lines} total lines)
              </span>
            )}
          </div>
          <button
            onClick={() => clearLogsMutation.mutate({ log_type: selectedLogType })}
            disabled={clearLogsMutation.isLoading}
            className="flex items-center px-3 py-1 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear Logs
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading logs...</p>
            </div>
          ) : logsData?.data?.logs && logsData.data.logs.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {logsData.data.logs.map((log: string, index: number) => {
                // Parse log line to extract timestamp, level, and message
                const timestampMatch = log.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
                const timestamp = timestampMatch ? timestampMatch[1] : '';
                const level = log.toLowerCase().includes('error') ? 'ERROR' :
                             log.toLowerCase().includes('warning') ? 'WARNING' :
                             log.toLowerCase().includes('info') ? 'INFO' : 'UNKNOWN';
                
                return (
                  <div key={index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start space-x-3">
                      {getLevelIcon(level)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">{timestamp}</span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(level)}`}>
                            {level}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-900 font-mono whitespace-pre-wrap">
                          {log}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto" />
              <p className="mt-2 text-gray-600">No logs found</p>
              {logsData?.data?.message && (
                <p className="text-sm text-gray-500">{logsData.data.message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Logs; 