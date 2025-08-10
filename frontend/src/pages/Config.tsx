import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Save, Download, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { configAPI } from '../services/api'
import { toast } from 'react-hot-toast'

interface ConfigTemplate {
  id: string
  name: string
  description: string
  content: string
}

const Config: React.FC = () => {
  const [configContent, setConfigContent] = useState('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const queryClient = useQueryClient()

  // Load current configuration
  const { isLoading: loadingConfig } = useQuery({
    queryKey: ['config'],
    queryFn: configAPI.getConfig,
    onSuccess: (data: any) => {
      setConfigContent(data.content || '')
    }
  })

  // Load templates
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['config-templates'],
    queryFn: configAPI.getTemplates,
    enabled: showTemplates
  })

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: configAPI.updateConfig,
    onSuccess: () => {
      toast.success('Configuration saved successfully!')
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
    onError: (error: any) => {
      toast.error(`Failed to save configuration: ${error.response?.data?.detail || error.message}`)
    }
  })

  // Validate configuration mutation
  const validateMutation = useMutation({
    mutationFn: configAPI.validateConfig,
    onSuccess: ({data}: any) => {
      if (data.valid) {
        setIsValid(true)
        setValidationMessage('Configuration is valid!')
        setValidationErrors([])
        setValidationWarnings(data.warnings || [])
        toast.success('Configuration is valid!')
      } else {
        setIsValid(false)
        setValidationMessage('Configuration validation failed')
        
        // Handle different error formats
        let errors = []
        if (data.errors && Array.isArray(data.errors)) {
          errors = data.errors.filter((error: string) => error && error.trim() !== '')
        } else if (data.error) {
          errors = [data.error]
        } else {
          errors = ['Configuration validation failed']
        }
        
        setValidationErrors(errors)
        setValidationWarnings(data.warnings || [])
        toast.error('Configuration validation failed')
      }
    },
        onError: (error: any) => {
      setIsValid(false)
      setValidationMessage('Configuration validation failed')
      
      // Handle different error formats
      let errors = []
      if (error.response?.data?.detail) {
        errors = [error.response.data.detail]
      } else if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        errors = error.response.data.errors.filter((error: string) => error && error.trim() !== '')
      } else {
        errors = ['Configuration validation failed']
      }
      
      setValidationErrors(errors)
      setValidationWarnings([])
      toast.error('Configuration validation failed')
    }
  })

  // Handle configuration validation
  const handleValidate = () => {
    if (!configContent.trim()) {
      toast.error('Please enter configuration content first')
      return
    }
    validateMutation.mutate(configContent)
  }

  // Handle configuration save
  const handleSave = () => {
    if (!configContent.trim()) {
      toast.error('Please enter configuration content first')
      return
    }
    saveMutation.mutate(configContent)
  }

  // Handle template selection
  const handleTemplateSelect = (template: ConfigTemplate) => {
    setConfigContent(template.content)
    setShowTemplates(false)
    toast.success(`Loaded template: ${template.name}`)
  }

  // Handle file download
  const handleDownload = () => {
    const blob = new Blob([configContent], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'borgmatic.yaml'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Configuration downloaded!')
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setConfigContent(content)
      toast.success('Configuration file loaded!')
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuration Management</h1>
          <p className="text-gray-600">Manage your Borgmatic configuration files</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </button>
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Configuration Templates</h3>
              {loadingTemplates ? (
                <div className="text-center py-4">Loading templates...</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {templates?.data?.map((template: ConfigTemplate) => (
                    <div
                      key={template.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <h4 className="font-medium text-gray-900">{template.name}</h4>
                      <p className="text-sm text-gray-600">{template.description}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowTemplates(false)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleValidate}
            disabled={validateMutation.isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {validateMutation.isLoading ? (
              'Validating...'
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Validate
              </>
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={saveMutation.isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {saveMutation.isLoading ? (
              'Saving...'
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <label className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            Upload
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={handleDownload}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </button>
        </div>
      </div>

      {/* Validation Status */}
      {isValid !== null && (
        <div className={`p-4 rounded-lg ${
          isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center mb-2">
            {isValid ? (
              <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            )}
            <span className={`text-sm font-medium ${
              isValid ? 'text-green-800' : 'text-red-800'
            }`}>
              {validationMessage}
            </span>
          </div>
          
          {/* Display Errors */}
          {validationErrors.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-red-800 mb-2">Validation Errors:</h4>
              <div className="bg-red-100 border border-red-300 rounded p-3">
                <ul className="space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm text-red-800 font-mono">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {/* Display Warnings */}
          {validationWarnings.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">Validation Warnings:</h4>
              <div className="bg-yellow-100 border border-yellow-300 rounded p-3">
                <ul className="space-y-1">
                  {validationWarnings.map((warning, index) => (
                    <li key={index} className="text-sm text-yellow-800 font-mono">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {/* Help for fixing errors - Show actual error messages */}
          {!isValid && validationErrors.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <h4 className="text-sm font-medium text-blue-800 mb-1">How to fix:</h4>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Check the error messages above for specific issues</li>
                <li>• Ensure YAML syntax is correct (proper indentation, no typos)</li>
                <li>• Verify that values match expected types (integers, strings, etc.)</li>
                <li>• Remove any unsupported configuration sections</li>
                <li>• Use the templates as a starting point for valid configurations</li>
                <li>• If you see Python traceback errors, check for malformed YAML or invalid configuration structure</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Configuration Editor */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Configuration Editor</h3>
          <p className="text-sm text-gray-600">Edit your Borgmatic configuration in YAML format</p>
        </div>
        
        <div className="p-4">
          {loadingConfig ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading configuration...</p>
            </div>
          ) : (
            <textarea
              value={configContent}
              onChange={(e) => setConfigContent(e.target.value)}
              placeholder="# Borgmatic Configuration
# Edit your configuration here...

repositories:
  - path: /path/to/repo
    label: my-repo

storage:
  compression: lz4
  encryption: repokey

retention:
  keep_daily: 7
  keep_weekly: 4
  keep_monthly: 6

hooks:
  before_backup:
    - echo 'Starting backup...'
  after_backup:
    - echo 'Backup completed!'"
              className="w-full h-96 p-4 border border-gray-300 rounded-md font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Configuration Help</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>Repositories:</strong> Define the paths to your Borg repositories</p>
          <p><strong>Storage:</strong> Configure compression and encryption settings</p>
          <p><strong>Retention:</strong> Set how long to keep backups</p>
          <p><strong>Hooks:</strong> Add scripts to run before/after backups</p>
          <p><strong>Validation:</strong> Always validate your configuration before saving</p>
        </div>
      </div>
    </div>
  )
}

export default Config 