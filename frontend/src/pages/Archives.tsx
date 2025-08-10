import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  Search, 
  Folder, 
  File, 
  HardDrive, 
  Calendar, 
  Trash2, 
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { archivesAPI } from '../services/api'
import { toast } from 'react-hot-toast'

interface Archive {
  id: string
  name: string
  timestamp: string
  size: string
  compressed_size: string
  deduplicated_size: string
  file_count: number
  repository: string
}

interface ArchiveFile {
  name: string
  type: 'file' | 'directory'
  size?: string
  path: string
  children?: ArchiveFile[]
}

const Archives: React.FC = () => {
  const [selectedRepository, setSelectedRepository] = useState<string>('')
  const [selectedArchive, setSelectedArchive] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPath, setCurrentPath] = useState<string>('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Get repositories (placeholder for future implementation)
  // const { data: repositories, isLoading: loadingRepos } = useQuery({
  //   queryKey: ['repositories'],
  //   queryFn: () => archivesAPI.listArchives(''),
  //   enabled: false
  // })

  // Get archives for selected repository
  const { data: archives, isLoading: loadingArchives } = useQuery({
    queryKey: ['archives', selectedRepository],
    queryFn: () => archivesAPI.listArchives(selectedRepository),
    enabled: !!selectedRepository
  })

  // Get archive details
  const { data: archiveDetails, isLoading: loadingDetails } = useQuery({
    queryKey: ['archive-details', selectedRepository, selectedArchive],
    queryFn: () => archivesAPI.getArchiveInfo(selectedRepository, selectedArchive),
    enabled: !!selectedRepository && !!selectedArchive
  })

  // Get archive contents
  const { data: archiveContents, isLoading: loadingContents } = useQuery({
    queryKey: ['archive-contents', selectedRepository, selectedArchive, currentPath],
    queryFn: () => archivesAPI.listContents(selectedRepository, selectedArchive, currentPath),
    enabled: !!selectedRepository && !!selectedArchive
  })

  // Delete archive mutation
  const deleteArchiveMutation = useMutation({
    mutationFn: ({ repository, archive }: { repository: string; archive: string }) =>
      archivesAPI.deleteArchive(repository, archive),
    onSuccess: () => {
      toast.success('Archive deleted successfully!')
      queryClient.invalidateQueries({ queryKey: ['archives', selectedRepository] })
      setSelectedArchive('')
    },
    onError: (error: any) => {
      toast.error(`Failed to delete archive: ${error.response?.data?.detail || error.message}`)
    }
  })

  // Handle repository selection
  const handleRepositorySelect = (repository: string) => {
    setSelectedRepository(repository)
    setSelectedArchive('')
    setCurrentPath('')
  }

  // Handle archive selection
  const handleArchiveSelect = (archive: string) => {
    setSelectedArchive(archive)
    setCurrentPath('')
  }

  // Handle folder expansion (placeholder for future implementation)
  // const handleFolderToggle = (folderPath: string) => {
  //   const newExpanded = new Set(expandedFolders)
  //   if (newExpanded.has(folderPath)) {
  //     newExpanded.delete(folderPath)
  //   } else {
  //     newExpanded.add(folderPath)
  //   }
  //   setExpandedFolders(newExpanded)
  // }

  // Handle file/folder click
  const handleItemClick = (item: ArchiveFile) => {
    if (item.type === 'directory') {
      const newPath = currentPath ? `${currentPath}/${item.name}` : item.name
      setCurrentPath(newPath)
    }
  }

  // Handle navigation breadcrumb
  const handleBreadcrumbClick = (index: number) => {
    const pathParts = currentPath.split('/')
    const newPath = pathParts.slice(0, index + 1).join('/')
    setCurrentPath(newPath)
  }

  // Handle archive deletion
  const handleDeleteArchive = (archive: string) => {
    deleteArchiveMutation.mutate({ repository: selectedRepository, archive })
    setShowDeleteConfirm(null)
  }

  // Filter archives based on search
  const filteredArchives = archives?.data?.filter((archive: Archive) =>
    archive.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    archive.timestamp.includes(searchQuery)
  ) || []

  // Format file size
  const formatFileSize = (size?: string) => {
    if (!size) return 'Unknown'
    return size
  }

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  // Get breadcrumb parts
  const breadcrumbParts = currentPath ? ['root', ...currentPath.split('/')] : ['root']

  // Mock repositories for now (will be replaced with actual API call)
  const mockRepositories = [
    { id: 'repo1', name: 'Default Repository', path: '/backups/default' },
    { id: 'repo2', name: 'Documents Backup', path: '/backups/documents' },
    { id: 'repo3', name: 'System Backup', path: '/backups/system' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archive Management</h1>
          <p className="text-gray-600">Browse and manage your backup archives</p>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['archives', selectedRepository] })}
          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Repository Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Repositories</h3>
            </div>
            <div className="p-4">
              {mockRepositories.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => handleRepositorySelect(repo.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedRepository === repo.id
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <HardDrive className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">{repo.name}</h4>
                      <p className="text-sm text-gray-600">{repo.path}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Archives List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Archives</h3>
                {selectedRepository && (
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search archives..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4">
              {!selectedRepository ? (
                <div className="text-center py-8">
                  <HardDrive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Select a repository to view archives</p>
                </div>
              ) : loadingArchives ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading archives...</p>
                </div>
              ) : filteredArchives.length === 0 ? (
                <div className="text-center py-8">
                  <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {searchQuery ? 'No archives found matching your search' : 'No archives found in this repository'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArchives.map((archive: Archive) => (
                    <div
                      key={archive.id}
                      onClick={() => handleArchiveSelect(archive.name)}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedArchive === archive.name
                          ? 'border-indigo-300 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Folder className="h-5 w-5 text-blue-500" />
                          <div>
                            <h4 className="font-medium text-gray-900">{archive.name}</h4>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                {formatTimestamp(archive.timestamp)}
                              </span>
                              <span>{formatFileSize(archive.size)}</span>
                              <span>{archive.file_count.toLocaleString()} files</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setShowDeleteConfirm(archive.name)
                            }}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Archive Details and File Browser */}
      {selectedArchive && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Archive Details */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Archive Details</h3>
            </div>
            <div className="p-4">
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading details...</p>
                </div>
              ) : archiveDetails?.data ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm font-medium text-gray-600">Name:</span>
                      <p className="text-sm text-gray-900">{archiveDetails.data.name}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Created:</span>
                      <p className="text-sm text-gray-900">{formatTimestamp(archiveDetails.data.timestamp)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Size:</span>
                      <p className="text-sm text-gray-900">{formatFileSize(archiveDetails.data.size)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Compressed:</span>
                      <p className="text-sm text-gray-900">{formatFileSize(archiveDetails.data.compressed_size)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Deduplicated:</span>
                      <p className="text-sm text-gray-900">{formatFileSize(archiveDetails.data.deduplicated_size)}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">Files:</span>
                      <p className="text-sm text-gray-900">{archiveDetails.data.file_count?.toLocaleString() || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No details available</p>
                </div>
              )}
            </div>
          </div>

          {/* File Browser */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">File Browser</h3>
            </div>
            <div className="p-4">
              {/* Breadcrumb */}
              <div className="flex items-center space-x-2 mb-4 text-sm">
                {breadcrumbParts.map((part, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <button
                      onClick={() => handleBreadcrumbClick(index)}
                      className={`hover:text-indigo-600 ${
                        index === breadcrumbParts.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-600'
                      }`}
                    >
                      {part}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {loadingContents ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading contents...</p>
                </div>
              ) : archiveContents?.data?.length === 0 ? (
                <div className="text-center py-8">
                  <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">This directory is empty</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {archiveContents?.data?.map((item: ArchiveFile, index: number) => (
                    <div
                      key={index}
                      onClick={() => handleItemClick(item)}
                      className="flex items-center p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                    >
                      {item.type === 'directory' ? (
                        <Folder className="h-4 w-4 text-blue-500 mr-3" />
                      ) : (
                        <File className="h-4 w-4 text-gray-500 mr-3" />
                      )}
                      <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                      {item.size && (
                        <span className="text-sm text-gray-600">{formatFileSize(item.size)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4 text-center">Delete Archive</h3>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Are you sure you want to delete the archive "{showDeleteConfirm}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteArchive(showDeleteConfirm)}
                  disabled={deleteArchiveMutation.isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteArchiveMutation.isLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Archives 