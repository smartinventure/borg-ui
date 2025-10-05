const { exec } = require('child_process');
const { promisify } = require('util');
const yamlManager = require('./yaml-manager');
const path = require('path');

const execAsync = promisify(exec);

/**
 * Apprise Integration Service
 * Handles notifications through Apprise for borgmatic hooks
 */
class AppriseService {
    constructor() {
        this.appriseConfigPath = './config/apprise.yaml';
        this.defaultConfig = {
            notifications: {
                success: {
                    enabled: false,
                    urls: [],
                    title: 'Backup Success',
                    body: 'Backup completed successfully'
                },
                failure: {
                    enabled: false,
                    urls: [],
                    title: 'Backup Failed',
                    body: 'Backup failed with error'
                },
                warning: {
                    enabled: false,
                    urls: [],
                    title: 'Backup Warning',
                    body: 'Backup completed with warnings'
                }
            },
            settings: {
                timeout: 30,
                retry_attempts: 3,
                retry_delay: 5
            }
        };
    }

    /**
     * Load Apprise configuration
     */
    async loadConfig() {
        try {
            const config = await yamlManager.readYaml(this.appriseConfigPath);
            return config || this.defaultConfig;
        } catch (error) {
            console.error('Failed to load Apprise config:', error.message);
            return this.defaultConfig;
        }
    }

    /**
     * Save Apprise configuration
     */
    async saveConfig(configData) {
        try {
            await yamlManager.writeYaml(this.appriseConfigPath, configData);
            console.log('Apprise configuration saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save Apprise config:', error.message);
            throw error;
        }
    }

    /**
     * Test Apprise connection
     */
    async testConnection(url) {
        try {
            const testCommand = `apprise -vv -t "Test Notification" -b "This is a test notification from Borgmatic UI" ${url}`;
            const { stdout, stderr } = await execAsync(testCommand, { timeout: 30000 });
            
            return {
                success: true,
                output: stdout,
                error: stderr
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send notification
     */
    async sendNotification(type, customData = {}) {
        try {
            const config = await this.loadConfig();
            const notification = config.notifications[type];
            
            if (!notification || !notification.enabled || !notification.urls.length) {
                return { success: false, message: 'Notification not configured' };
            }

            const title = customData.title || notification.title;
            const body = customData.body || notification.body;
            const urls = notification.urls.join(' ');

            const command = `apprise -vv -t "${title}" -b "${body}" ${urls}`;
            const { stdout, stderr } = await execAsync(command, { 
                timeout: config.settings.timeout * 1000 
            });

            return {
                success: true,
                output: stdout,
                error: stderr
            };
        } catch (error) {
            console.error(`Failed to send ${type} notification:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send success notification
     */
    async sendSuccessNotification(customData = {}) {
        return await this.sendNotification('success', customData);
    }

    /**
     * Send failure notification
     */
    async sendFailureNotification(customData = {}) {
        return await this.sendNotification('failure', customData);
    }

    /**
     * Send warning notification
     */
    async sendWarningNotification(customData = {}) {
        return await this.sendNotification('warning', customData);
    }

    /**
     * Add notification URL
     */
    async addNotificationUrl(type, url) {
        try {
            const config = await this.loadConfig();
            
            if (!config.notifications[type]) {
                config.notifications[type] = {
                    enabled: false,
                    urls: [],
                    title: '',
                    body: ''
                };
            }

            if (!config.notifications[type].urls.includes(url)) {
                config.notifications[type].urls.push(url);
            }

            await this.saveConfig(config);
            return true;
        } catch (error) {
            console.error('Failed to add notification URL:', error.message);
            throw error;
        }
    }

    /**
     * Remove notification URL
     */
    async removeNotificationUrl(type, url) {
        try {
            const config = await this.loadConfig();
            
            if (config.notifications[type] && config.notifications[type].urls) {
                config.notifications[type].urls = config.notifications[type].urls.filter(u => u !== url);
            }

            await this.saveConfig(config);
            return true;
        } catch (error) {
            console.error('Failed to remove notification URL:', error.message);
            throw error;
        }
    }

    /**
     * Enable/disable notification type
     */
    async setNotificationEnabled(type, enabled) {
        try {
            const config = await this.loadConfig();
            
            if (!config.notifications[type]) {
                config.notifications[type] = {
                    enabled: false,
                    urls: [],
                    title: '',
                    body: ''
                };
            }

            config.notifications[type].enabled = enabled;
            await this.saveConfig(config);
            return true;
        } catch (error) {
            console.error('Failed to set notification enabled:', error.message);
            throw error;
        }
    }

    /**
     * Update notification settings
     */
    async updateNotificationSettings(type, settings) {
        try {
            const config = await this.loadConfig();
            
            if (!config.notifications[type]) {
                config.notifications[type] = {
                    enabled: false,
                    urls: [],
                    title: '',
                    body: ''
                };
            }

            config.notifications[type] = {
                ...config.notifications[type],
                ...settings
            };

            await this.saveConfig(config);
            return true;
        } catch (error) {
            console.error('Failed to update notification settings:', error.message);
            throw error;
        }
    }

    /**
     * Get supported notification services
     */
    getSupportedServices() {
        return {
            email: {
                name: 'Email',
                description: 'Send notifications via email',
                example: 'mailto://user:pass@gmail.com'
            },
            discord: {
                name: 'Discord',
                description: 'Send notifications to Discord webhook',
                example: 'discord://webhook_id/webhook_token'
            },
            slack: {
                name: 'Slack',
                description: 'Send notifications to Slack',
                example: 'slack://token@channel'
            },
            telegram: {
                name: 'Telegram',
                description: 'Send notifications to Telegram',
                example: 'tgram://bot_token/chat_id'
            },
            webhook: {
                name: 'Webhook',
                description: 'Send notifications to custom webhook',
                example: 'https://hooks.slack.com/services/...'
            },
            gotify: {
                name: 'Gotify',
                description: 'Send notifications to Gotify server',
                example: 'gotify://hostname/token'
            },
            pushover: {
                name: 'Pushover',
                description: 'Send notifications via Pushover',
                example: 'pover://user@token'
            }
        };
    }

    /**
     * Generate borgmatic hooks for Apprise
     */
    async generateBorgmaticHooks() {
        try {
            const config = await this.loadConfig();
            const hooks = [];

            // Success notification
            if (config.notifications.success.enabled && config.notifications.success.urls.length > 0) {
                const urls = config.notifications.success.urls.join(' ');
                hooks.push({
                    type: 'after_backup',
                    command: `apprise -vv -t "${config.notifications.success.title}" -b "${config.notifications.success.body}" ${urls}`
                });
            }

            // Failure notification
            if (config.notifications.failure.enabled && config.notifications.failure.urls.length > 0) {
                const urls = config.notifications.failure.urls.join(' ');
                hooks.push({
                    type: 'on_error',
                    command: `apprise -vv -t "${config.notifications.failure.title}" -b "${config.notifications.failure.body}" ${urls}`
                });
            }

            return hooks;
        } catch (error) {
            console.error('Failed to generate borgmatic hooks:', error.message);
            return [];
        }
    }

    /**
     * Get notification status
     */
    async getNotificationStatus() {
        try {
            const config = await this.loadConfig();
            
            return {
                success: {
                    enabled: config.notifications.success.enabled,
                    urlCount: config.notifications.success.urls.length
                },
                failure: {
                    enabled: config.notifications.failure.enabled,
                    urlCount: config.notifications.failure.urls.length
                },
                warning: {
                    enabled: config.notifications.warning.enabled,
                    urlCount: config.notifications.warning.urls.length
                }
            };
        } catch (error) {
            console.error('Failed to get notification status:', error.message);
            return null;
        }
    }
}

module.exports = new AppriseService();
