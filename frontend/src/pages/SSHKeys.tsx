import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Key,
  Wifi,
  Download,
  Upload
} from 'lucide-react';
import { sshKeysAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

interface SSHKey {
  id: number;
  name: string;
  description: string | null;
  key_type: string;
  public_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

const SSHKeys: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [editingKey, setEditingKey] = useState<SSHKey | null>(null);

  // Get SSH keys
  const { data: sshKeysData, isLoading } = useQuery({
    queryKey: ['ssh-keys'],
    queryFn: sshKeysAPI.getSSHKeys,
  });

  // Create SSH key mutation
  const createSSHKeyMutation = useMutation({
    mutationFn: sshKeysAPI.createSSHKey,
    onSuccess: () => {
      toast.success('SSH key created successfully');
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create SSH key');
    },
  });

  // Generate SSH key mutation
  const generateSSHKeyMutation = useMutation({
    mutationFn: sshKeysAPI.generateSSHKey,
    onSuccess: () => {
      toast.success('SSH key generated successfully');
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setShowGenerateModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to generate SSH key');
    },
  });

  // Update SSH key mutation
  const updateSSHKeyMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      sshKeysAPI.updateSSHKey(id, data),
    onSuccess: () => {
      toast.success('SSH key updated successfully');
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
      setEditingKey(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update SSH key');
    },
  });

  // Delete SSH key mutation
  const deleteSSHKeyMutation = useMutation({
    mutationFn: sshKeysAPI.deleteSSHKey,
    onSuccess: () => {
      toast.success('SSH key deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['ssh-keys'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete SSH key');
    },
  });

  // Test SSH connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: sshKeysAPI.testSSHConnection,
    onSuccess: (data: any) => {
      if (data.data.connection_test.success) {
        toast.success('SSH connection successful!');
      } else {
        toast.error(`SSH connection failed: ${data.data.connection_test.error}`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to test SSH connection');
    },
  });

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    key_type: 'rsa',
    public_key: '',
    private_key: '',
  });

  const [generateForm, setGenerateForm] = useState({
    name: '',
    description: '',
    key_type: 'rsa',
  });

  const [testForm, setTestForm] = useState({
    host: '',
    username: '',
    port: 22,
  });

  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  const handleCreateSSHKey = (e: React.FormEvent) => {
    e.preventDefault();
    createSSHKeyMutation.mutate(createForm);
  };

  const handleGenerateSSHKey = (e: React.FormEvent) => {
    e.preventDefault();
    generateSSHKeyMutation.mutate(generateForm);
  };

  const handleUpdateSSHKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingKey) {
      updateSSHKeyMutation.mutate({
        id: editingKey.id,
        data: editForm,
      });
    }
  };

  const handleDeleteSSHKey = (sshKey: SSHKey) => {
    if (window.confirm(`Are you sure you want to delete SSH key "${sshKey.name}"?`)) {
      deleteSSHKeyMutation.mutate(sshKey.id);
    }
  };

  const handleTestConnection = (keyId: number) => {
    testConnectionMutation.mutate({
      key_id: keyId,
      host: testForm.host,
      username: testForm.username,
      port: testForm.port,
    });
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateForm({
      name: '',
      description: '',
      key_type: 'rsa',
      public_key: '',
      private_key: '',
    });
  };

  const openGenerateModal = () => {
    setShowGenerateModal(true);
    setGenerateForm({
      name: '',
      description: '',
      key_type: 'rsa',
    });
  };

  const openTestModal = () => {
    setShowTestModal(true);
    setTestForm({
      host: '',
      username: '',
      port: 22,
    });
  };

  const openEditModal = (sshKey: SSHKey) => {
    setEditingKey(sshKey);
    setEditForm({
      name: sshKey.name,
      description: sshKey.description || '',
      is_active: sshKey.is_active,
    });
  };

  const getKeyTypeIcon = (keyType: string) => {
    switch (keyType) {
      case 'rsa':
        return <Key className="w-4 h-4 text-blue-500" />;
      case 'ed25519':
        return <Key className="w-4 h-4 text-green-500" />;
      case 'ecdsa':
        return <Key className="w-4 h-4 text-purple-500" />;
      default:
        return <Key className="w-4 h-4 text-gray-500" />;
    }
  };

  const getKeyTypeLabel = (keyType: string) => {
    switch (keyType) {
      case 'rsa':
        return 'RSA';
      case 'ed25519':
        return 'Ed25519';
      case 'ecdsa':
        return 'ECDSA';
      default:
        return keyType.toUpperCase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SSH Key Management</h1>
          <p className="text-gray-600">Manage SSH keys for remote repository access</p>
        </div>
        {user?.is_admin && (
          <div className="flex space-x-3">
            <button
              onClick={openGenerateModal}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Generate Key
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Key
            </button>
          </div>
        )}
      </div>

      {/* SSH Keys List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading SSH keys...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sshKeysData?.data?.ssh_keys?.map((sshKey: SSHKey) => (
            <div key={sshKey.id} className="bg-white rounded-lg border shadow-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    {getKeyTypeIcon(sshKey.key_type)}
                    <h3 className="text-lg font-medium text-gray-900">{sshKey.name}</h3>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      sshKey.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {sshKey.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {sshKey.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Description</label>
                      <p className="text-sm text-gray-900">{sshKey.description}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-500">Key Type</label>
                    <p className="text-sm text-gray-900">{getKeyTypeLabel(sshKey.key_type)}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Public Key</label>
                    <div className="flex items-center space-x-2">
                      <p className="text-sm text-gray-900 font-mono truncate flex-1">
                        {sshKey.public_key}
                      </p>
                      <button
                        onClick={() => navigator.clipboard.writeText(sshKey.public_key)}
                        className="text-blue-600 hover:text-blue-800"
                        title="Copy public key"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-sm text-gray-900">
                      {new Date(sshKey.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {user?.is_admin && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openTestModal()}
                          disabled={testConnectionMutation.isLoading}
                          className="flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          <Wifi className="w-3 h-3 mr-1" />
                          Test
                        </button>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => openEditModal(sshKey)}
                          className="flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteSSHKey(sshKey)}
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

      {/* Create SSH Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import SSH Key</h3>
              <form onSubmit={handleCreateSSHKey} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Type</label>
                  <select
                    value={createForm.key_type}
                    onChange={(e) => setCreateForm({ ...createForm, key_type: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="rsa">RSA</option>
                    <option value="ed25519">Ed25519</option>
                    <option value="ecdsa">ECDSA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
                  <textarea
                    value={createForm.public_key}
                    onChange={(e) => setCreateForm({ ...createForm, public_key: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Private Key</label>
                  <textarea
                    value={createForm.private_key}
                    onChange={(e) => setCreateForm({ ...createForm, private_key: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={6}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    required
                  />
                </div>
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
                    disabled={createSSHKeyMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createSSHKeyMutation.isLoading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Generate SSH Key Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Generate SSH Key</h3>
              <form onSubmit={handleGenerateSSHKey} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={generateForm.name}
                    onChange={(e) => setGenerateForm({ ...generateForm, name: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={generateForm.description}
                    onChange={(e) => setGenerateForm({ ...generateForm, description: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Type</label>
                  <select
                    value={generateForm.key_type}
                    onChange={(e) => setGenerateForm({ ...generateForm, key_type: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="rsa">RSA (Recommended)</option>
                    <option value="ed25519">Ed25519 (Modern)</option>
                    <option value="ecdsa">ECDSA</option>
                  </select>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generateSSHKeyMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    {generateSSHKeyMutation.isLoading ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Test Connection Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Test SSH Connection</h3>
              <form onSubmit={(e) => { e.preventDefault(); handleTestConnection(1); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host</label>
                  <input
                    type="text"
                    value={testForm.host}
                    onChange={(e) => setTestForm({ ...testForm, host: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={testForm.username}
                    onChange={(e) => setTestForm({ ...testForm, username: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="user"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                  <input
                    type="number"
                    value={testForm.port}
                    onChange={(e) => setTestForm({ ...testForm, port: parseInt(e.target.value) })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    min="1"
                    max="65535"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowTestModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={testConnectionMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {testConnectionMutation.isLoading ? 'Testing...' : 'Test Connection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit SSH Key Modal */}
      {editingKey && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit SSH Key</h3>
              <form onSubmit={handleUpdateSSHKey} className="space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
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
                    onClick={() => setEditingKey(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateSSHKeyMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateSSHKeyMutation.isLoading ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SSHKeys;
