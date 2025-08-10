import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Play, 
  Pause, 
  Clock, 
  Settings,
  CheckCircle
} from 'lucide-react';
import { scheduleAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

interface ScheduledJob {
  id: number;
  name: string;
  cron_expression: string;
  repository: string | null;
  enabled: boolean;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
  updated_at: string | null;
  description: string | null;
}

const Schedule: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [showCronBuilder, setShowCronBuilder] = useState(false);

  // Get scheduled jobs
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['scheduled-jobs'],
    queryFn: scheduleAPI.getScheduledJobs,
  });

  // Get cron presets
  const { data: presetsData } = useQuery({
    queryKey: ['cron-presets'],
    queryFn: scheduleAPI.getCronPresets,
  });

  // Get upcoming jobs
  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-jobs'],
    queryFn: () => scheduleAPI.getUpcomingJobs(24),
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: scheduleAPI.createScheduledJob,
    onSuccess: () => {
      toast.success('Scheduled job created successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-jobs'] });
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create scheduled job');
    },
  });

  // Update job mutation
  const updateJobMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      scheduleAPI.updateScheduledJob(id, data),
    onSuccess: () => {
      toast.success('Scheduled job updated successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-jobs'] });
      setEditingJob(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update scheduled job');
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: scheduleAPI.deleteScheduledJob,
    onSuccess: () => {
      toast.success('Scheduled job deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-jobs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete scheduled job');
    },
  });

  // Toggle job mutation
  const toggleJobMutation = useMutation({
    mutationFn: scheduleAPI.toggleScheduledJob,
    onSuccess: () => {
      toast.success('Scheduled job toggled successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-jobs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to toggle scheduled job');
    },
  });

  // Run job now mutation
  const runJobNowMutation = useMutation({
    mutationFn: scheduleAPI.runScheduledJobNow,
    onSuccess: () => {
      toast.success('Scheduled job executed successfully');
      queryClient.invalidateQueries({ queryKey: ['scheduled-jobs'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to run scheduled job');
    },
  });

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    cron_expression: '0 0 * * *',
    repository: '',
    config_file: '',
    enabled: true,
    description: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    cron_expression: '',
    repository: '',
    config_file: '',
    enabled: true,
    description: '',
  });

  const handleCreateJob = (e: React.FormEvent) => {
    e.preventDefault();
    createJobMutation.mutate(createForm);
  };

  const handleUpdateJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingJob) {
      updateJobMutation.mutate({
        id: editingJob.id,
        data: editForm,
      });
    }
  };

  const handleDeleteJob = (job: ScheduledJob) => {
    if (window.confirm(`Are you sure you want to delete scheduled job "${job.name}"?`)) {
      deleteJobMutation.mutate(job.id);
    }
  };

  const handleToggleJob = (job: ScheduledJob) => {
    toggleJobMutation.mutate(job.id);
  };

  const handleRunJobNow = (job: ScheduledJob) => {
    runJobNowMutation.mutate(job.id);
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateForm({
      name: '',
      cron_expression: '0 0 * * *',
      repository: '',
      config_file: '',
      enabled: true,
      description: '',
    });
  };

  const openEditModal = (job: ScheduledJob) => {
    setEditingJob(job);
    setEditForm({
      name: job.name,
      cron_expression: job.cron_expression,
      repository: job.repository || '',
      config_file: '',
      enabled: job.enabled,
      description: job.description || '',
    });
  };

  const openCronBuilder = () => {
    setShowCronBuilder(true);
  };

  const applyCronPreset = (preset: any) => {
    setCreateForm({ ...createForm, cron_expression: preset.expression });
  };

  const getStatusIcon = (enabled: boolean) => {
    return enabled ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <Pause className="w-4 h-4 text-gray-500" />
    );
  };

  const formatCronExpression = (expression: string) => {
    try {
      // Simple cron description mapping
      const descriptions: { [key: string]: string } = {
        '0 0 * * *': 'Daily at midnight',
        '0 2 * * *': 'Daily at 2 AM',
        '0 */6 * * *': 'Every 6 hours',
        '0 * * * *': 'Every hour',
        '*/15 * * * *': 'Every 15 minutes',
        '*/5 * * * *': 'Every 5 minutes',
        '* * * * *': 'Every minute',
        '0 0 * * 0': 'Weekly on Sunday',
        '0 0 1 * *': 'Monthly on 1st',
        '0 9 * * 1-5': 'Weekdays at 9 AM',
        '0 6 * * 0,6': 'Weekends at 6 AM',
      };
      return descriptions[expression] || expression;
    } catch {
      return expression;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
          <p className="text-gray-600">Manage scheduled backup jobs</p>
        </div>
        {user?.is_admin && (
          <button
            onClick={openCreateModal}
            className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Job
          </button>
        )}
      </div>

      {/* Upcoming Jobs */}
      {upcomingData && upcomingData.data?.upcoming_jobs?.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Jobs (Next 24 Hours)</h3>
          <div className="space-y-3">
            {upcomingData.data.upcoming_jobs.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="font-medium text-gray-900">{job.name}</p>
                    <p className="text-sm text-gray-600">{job.repository}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(job.next_run).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCronExpression(job.cron_expression)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Jobs List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading scheduled jobs...</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Scheduled Jobs</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {jobsData?.data?.jobs?.map((job: ScheduledJob) => (
              <div key={job.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.enabled)}
                    <div>
                      <h4 className="font-medium text-gray-900">{job.name}</h4>
                      <p className="text-sm text-gray-600">
                        {formatCronExpression(job.cron_expression)}
                      </p>
                      {job.repository && (
                        <p className="text-sm text-gray-500">Repository: {job.repository}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="text-right">
                      <p className="text-sm text-gray-900">
                        Next: {job.next_run ? new Date(job.next_run).toLocaleString() : 'Never'}
                      </p>
                      {job.last_run && (
                        <p className="text-xs text-gray-500">
                          Last: {new Date(job.last_run).toLocaleString()}
                        </p>
                      )}
                    </div>
                    {user?.is_admin && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRunJobNow(job)}
                          disabled={runJobNowMutation.isLoading}
                          className="flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Run Now
                        </button>
                        <button
                          onClick={() => handleToggleJob(job)}
                          disabled={toggleJobMutation.isLoading}
                          className="flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          {job.enabled ? (
                            <>
                              <Pause className="w-3 h-3 mr-1" />
                              Disable
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3 mr-1" />
                              Enable
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => openEditModal(job)}
                          className="flex items-center px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-800"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteJob(job)}
                          className="flex items-center px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {jobsData?.data?.jobs?.length === 0 && (
              <div className="p-6 text-center text-gray-500">
                No scheduled jobs found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Scheduled Job</h3>
              <form onSubmit={handleCreateJob} className="space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={createForm.cron_expression}
                      onChange={(e) => setCreateForm({ ...createForm, cron_expression: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0 0 * * *"
                      required
                    />
                    <button
                      type="button"
                      onClick={openCronBuilder}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatCronExpression(createForm.cron_expression)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repository</label>
                  <input
                    type="text"
                    value={createForm.repository}
                    onChange={(e) => setCreateForm({ ...createForm, repository: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Optional description"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={createForm.enabled}
                    onChange={(e) => setCreateForm({ ...createForm, enabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Enabled</label>
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
                    disabled={createJobMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {createJobMutation.isLoading ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Cron Builder Modal */}
      {showCronBuilder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cron Expression Builder</h3>
              
              {/* Cron Presets */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Presets</h4>
                <div className="grid grid-cols-1 gap-2">
                  {presetsData?.data?.presets?.map((preset: any) => (
                    <button
                      key={preset.expression}
                      onClick={() => applyCronPreset(preset)}
                      className="text-left p-2 text-sm border border-gray-200 rounded hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">{preset.name}</div>
                      <div className="text-xs text-gray-500">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCronBuilder(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      {editingJob && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Scheduled Job</h3>
              <form onSubmit={handleUpdateJob} className="space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cron Expression</label>
                  <input
                    type="text"
                    value={editForm.cron_expression}
                    onChange={(e) => setEditForm({ ...editForm, cron_expression: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {formatCronExpression(editForm.cron_expression)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repository</label>
                  <input
                    type="text"
                    value={editForm.repository}
                    onChange={(e) => setEditForm({ ...editForm, repository: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editForm.enabled}
                    onChange={(e) => setEditForm({ ...editForm, enabled: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Enabled</label>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingJob(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateJobMutation.isLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateJobMutation.isLoading ? 'Updating...' : 'Update'}
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

export default Schedule; 