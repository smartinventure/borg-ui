import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Database,
  Shield,
  RefreshCw,
  FileText,
  Eye,
  EyeOff,
  FolderOpen,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { repositoriesAPI, sshKeysAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

interface Repository {
  id: number;
  name: string;
  path: string;
  encryption: string;
  compression: string;
  last_backup: string | null;
  total_size: string | null;
  archive_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

const Repositories: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRepository, setEditingRepository] = useState<Repository | null>(null);


  // Get repositories
  const { data: repositoriesData, isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: repositoriesAPI.getRepositories,
  });

  // Get SSH keys for remote repositories
  const { data: sshKeysData } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: sshKeysAPI.getSSHKeys,
  });

  // Create repository mutation
  const createRepositoryMutation = useMutation({
    mutationFn: repositoriesAPI.createRepository,
    onSuccess: () => {
      toast.success('Repository created successfully');
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create repository');
    },
  });

  // Update repository mutation
  const updateRepositoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      repositoriesAPI.updateRepository(id, data),
    onSuccess: () => {
      toast.success('Repository updated successfully');
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
      setEditingRepository(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update repository');
    },
  });

  // Delete repository mutation
  const deleteRepositoryMutation = useMutation({
    mutationFn: repositoriesAPI.deleteRepository,
    onSuccess: () => {
      toast.success('Repository deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['repositories'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete repository');
    },
  });

  // Check repository mutation
  const checkRepositoryMutation = useMutation({
    mutationFn: repositoriesAPI.checkRepository,
    onSuccess: () => {
      toast.success('Repository check completed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to check repository');
    },
  });

  // Compact repository mutation
  const compactRepositoryMutation = useMutation({
    mutationFn: repositoriesAPI.compactRepository,
    onSuccess: () => {
      toast.success('Repository compaction completed');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to compact repository');
    },
  });

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    path: '/opt/speedbits/backups', // Pre-fill with standard backup path
    encryption: 'repokey',
    compression: 'lz4',
    passphrase: '',
    confirmPassphrase: '',
    repository_type: 'local',
    host: '',
    port: 22,
    username: '',
    ssh_key_id: null as number | null,
  });

  // UI states
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [pathTestResult, setPathTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [showPathModal, setShowPathModal] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    path: '',
    compression: 'lz4',
    is_active: true,
  });

  // Test path functionality
  const testPath = async () => {
    if (!createForm.path.trim()) {
      setPathTestResult({ status: 'error', message: 'Please enter a path' });
      return;
    }

    setPathTestResult({ status: 'testing', message: 'Testing path...' });

    try {
      // Test if path exists
      const response = await fetch('/api/repositories/test-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ path: createForm.path })
      });

      const result = await response.json();

      if (result.exists) {
        setPathTestResult({ status: 'success', message: 'Path exists and is writable' });
      } else {
        setShowPathModal(true);
      }
    } catch (error) {
      setPathTestResult({ status: 'error', message: 'Failed to test path' });
    }
  };

  const createPath = async () => {
    try {
      const response = await fetch('/api/repositories/create-path', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ path: createForm.path })
      });

      const result = await response.json();

      if (result.success) {
        setPathTestResult({ status: 'success', message: 'Path created successfully' });
        setShowPathModal(false);
      } else {
        setPathTestResult({ status: 'error', message: result.message || 'Failed to create path' });
        setShowPathModal(false);
      }
    } catch (error) {
      setPathTestResult({ status: 'error', message: 'Failed to create path' });
      setShowPathModal(false);
    }
  };

  const handleCreateRepository = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passphrase confirmation
    if (createForm.encryption !== 'none' && createForm.passphrase !== createForm.confirmPassphrase) {
      toast.error('Passphrases do not match');
      return;
    }

    // Test path before creating repository
    if (pathTestResult.status !== 'success') {
      toast.error('Please test the path first');
      return;
    }

    createRepositoryMutation.mutate(createForm);
  };

  const handleUpdateRepository = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRepository) {
      updateRepositoryMutation.mutate({
        id: editingRepository.id,
        data: editForm,
      });
    }
  };

  const handleDeleteRepository = (repository: Repository) => {
    if (window.confirm(`Are you sure you want to delete repository "${repository.name}"?`)) {
      deleteRepositoryMutation.mutate(repository.id);
    }
  };

  const handleCheckRepository = (repository: Repository) => {
    checkRepositoryMutation.mutate(repository.id);
  };

  const handleCompactRepository = (repository: Repository) => {
    if (window.confirm(`Are you sure you want to compact repository "${repository.name}"?`)) {
      compactRepositoryMutation.mutate(repository.id);
    }
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateForm({
      name: '',
      path: '/opt/speedbits/backups', // Pre-fill with standard path
      encryption: 'repokey',
      compression: 'lz4',
      passphrase: '',
      confirmPassphrase: '',
      repository_type: 'local',
      host: '',
      port: 22,
      username: '',
      ssh_key_id: null,
    });
    setShowPassphrase(false);
    setPathTestResult({ status: 'idle', message: '' });
  };

  const openEditModal = (repository: Repository) => {
    setEditingRepository(repository);
    setEditForm({
      name: repository.name,
      path: repository.path,
      compression: repository.compression,
      is_active: repository.is_active,
    });
  };

  const getEncryptionIcon = (encryption: string) => {
    switch (encryption) {
      case 'repokey':
        return <Shield className="w-4 h-4 text-green-500" />;
      case 'keyfile':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'none':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Shield className="w-4 h-4 text-gray-500" />;
    }
  };

  const getCompressionLabel = (compression: string) => {
    switch (compression) {
      case 'lz4':
        return 'LZ4 (Fast)';
      case 'zstd':
        return 'Zstandard';
      case 'zlib':
        return 'Zlib';
      case 'none':
        return 'None';
      default:
        return compression;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repository Management</h1>
          <p className="text-gray-600">Create and manage Borg repositories</p>
        </div>
        {user?.is_admin && (
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Repository
          </button>
        )}
      </div>

      {/* Repositories List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading repositories...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {repositoriesData?.data?.repositories?.map((repository: Repository) => (
            <div key={repository.id} className="bg-white rounded-lg border shadow-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-medium text-gray-900">{repository.name}</h3>
                  </div>
                  <div className="flex items-center space-x-1">
                    {getEncryptionIcon(repository.encryption)}
                    <span className="text-xs text-gray-500">{repository.encryption}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Path</label>
                    <p className="text-sm text-gray-900 font-mono">{repository.path}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Compression</label>
                    <p className="text-sm text-gray-900">{getCompressionLabel(repository.compression)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Archives</label>
                      <p className="text-sm text-gray-900">{repository.archive_count}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        repository.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {repository.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {repository.last_backup && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Last Backup</label>
                      <p className="text-sm text-gray-900">
                        {new Date(repository.last_backup).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  {repository.total_size && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Total Size</label>
                      <p className="text-sm text-gray-900">{repository.total_size}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {user?.is_admin && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleCheckRepository(repository)}
                          disabled={checkRepositoryMutation.isLoading}
                          className="flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Check
                        </button>
                        <button
                          onClick={() => handleCompactRepository(repository)}
                          disabled={compactRepositoryMutation.isLoading}
                          className="flex items-center px-2 py-1 text-xs font-medium text-yellow-600 hover:text-yellow-800 disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Compact
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(repository)}
                          className="flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteRepository(repository)}
                          className="flex items-center px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Repository Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Repository</h3>
              <form onSubmit={handleCreateRepository} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repository Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter repository name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repository Type</label>
                  <select
                    value={createForm.repository_type}
                    onChange={(e) => setCreateForm({ ...createForm, repository_type: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="local">Local</option>
                    <option value="ssh">SSH</option>
                    <option value="sftp">SFTP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Path (Only provide base path, not repo name, this will be appended)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={createForm.path}
                      onChange={(e) => {
                        setCreateForm({ ...createForm, path: e.target.value });
                        setPathTestResult({ status: 'idle', message: '' });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="/opt/speedbits/backups"
                      required
                    />
                    <button
                      type="button"
                      onClick={testPath}
                      disabled={pathTestResult.status === 'testing'}
                      className="flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FolderOpen className="w-4 h-4 mr-1" />
                      Test Path
                    </button>
                  </div>
                  
                  {/* Path test result */}
                  {pathTestResult.status !== 'idle' && (
                    <div className={`mt-2 flex items-center text-sm ${
                      pathTestResult.status === 'success' ? 'text-green-600' : 
                      pathTestResult.status === 'error' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {pathTestResult.status === 'success' && <CheckCircle2 className="w-4 h-4 mr-1" />}
                      {pathTestResult.status === 'error' && <XCircle className="w-4 h-4 mr-1" />}
                      {pathTestResult.status === 'testing' && <RefreshCw className="w-4 h-4 mr-1 animate-spin" />}
                      {pathTestResult.message}
                    </div>
                  )}
                </div>
                {createForm.repository_type !== 'local' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                      <input
                        type="text"
                        value={createForm.host}
                        onChange={(e) => setCreateForm({ ...createForm, host: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="192.168.1.100"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <input
                        type="text"
                        value={createForm.username}
                        onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="user"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                      <input
                        type="number"
                        value={createForm.port}
                        onChange={(e) => setCreateForm({ ...createForm, port: parseInt(e.target.value) })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        max="65535"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SSH Key</label>
                      <select
                        value={createForm.ssh_key_id || ''}
                        onChange={(e) => setCreateForm({ ...createForm, ssh_key_id: e.target.value ? parseInt(e.target.value) : null })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      >
                        <option value="">Select SSH Key</option>
                        {sshKeysData?.data?.ssh_keys?.map((key: any) => (
                          <option key={key.id} value={key.id}>
                            {key.name} ({key.key_type})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
                  <select
                    value={createForm.encryption}
                    onChange={(e) => setCreateForm({ ...createForm, encryption: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="repokey-blake2">Repokey Blake2 (Recommended)</option>
                    <option value="repokey">Repokey</option>
                    <option value="keyfile-blake2">Keyfile Blake2</option>
                    <option value="keyfile">Keyfile</option>
                    <option value="none">None (Unencrypted)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Compression</label>
                  <select
                    value={createForm.compression}
                    onChange={(e) => setCreateForm({ ...createForm, compression: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="lz4">LZ4 (Fast)</option>
                    <option value="zstd">Zstandard</option>
                    <option value="zlib">Zlib</option>
                    <option value="none">None</option>
                  </select>
                </div>

                {createForm.encryption !== 'none' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Passphrase
                        <button
                          type="button"
                          onClick={() => setShowPassphrase(!showPassphrase)}
                          className="ml-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          {showPassphrase ? <EyeOff className="w-4 h-4 inline" /> : <Eye className="w-4 h-4 inline" />}
                          {showPassphrase ? 'Hide' : 'Show'} password
                        </button>
                      </label>
                      <input
                        type={showPassphrase ? "text" : "password"}
                        value={createForm.passphrase}
                        onChange={(e) => setCreateForm({ ...createForm, passphrase: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter passphrase"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Passphrase</label>
                      <input
                        type={showPassphrase ? "text" : "password"}
                        value={createForm.confirmPassphrase}
                        onChange={(e) => setCreateForm({ ...createForm, confirmPassphrase: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Confirm passphrase"
                        required
                      />
                      {createForm.passphrase && createForm.confirmPassphrase && createForm.passphrase !== createForm.confirmPassphrase && (
                        <p className="mt-1 text-sm text-red-600">Passphrases do not match</p>
                      )}
                    </div>
                  </>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createRepositoryMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createRepositoryMutation.isLoading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Repository Modal */}
      {editingRepository && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Repository</h3>
              <form onSubmit={handleUpdateRepository} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Path</label>
                  <input
                    type="text"
                    value={editForm.path}
                    onChange={(e) => setEditForm({ ...editForm, path: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Compression</label>
                  <select
                    value={editForm.compression}
                    onChange={(e) => setEditForm({ ...editForm, compression: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="lz4">LZ4 (Fast)</option>
                    <option value="zstd">Zstandard</option>
                    <option value="zlib">Zlib</option>
                    <option value="none">None</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Active</label>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingRepository(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateRepositoryMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateRepositoryMutation.isLoading ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Path Creation Modal */}
      {showPathModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Path Does Not Exist</h3>
              <p className="text-sm text-gray-600 mb-4">
                The path <code className="bg-gray-100 px-1 rounded">{createForm.path}</code> does not exist.
                Do you want to create it?
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowPathModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={createPath}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Yes, Create Path
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repositories;
