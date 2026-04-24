import ApiService from './api';

class ReminderService {
  /**
   * Create a new reminder
   * @param {Object} reminderData - The reminder data
   * @returns {Promise<Object>} The created reminder
   */
  async createReminder(reminderData) {
    try {
      console.log('🔔 Creating reminder with data:', reminderData);

      const requestBody = {
        title: reminderData.title,
        description: reminderData.description || null,
        reminderType: reminderData.type,
        scheduledAt: reminderData.dateTime,
        isEnabled: reminderData.isEnabled,
      };

      console.log('📤 Sending request body:', requestBody);
      console.log('🌐 API endpoint: /reminders');

      const response = await ApiService.makeRequest('/reminders', {
        method: 'POST',
        body: requestBody
      });

      console.log('📥 Received response:', response);

      if (response.success) {
        console.log('✅ Reminder created successfully:', response.data);
        return response.data;
      } else {
        console.error('❌ Backend returned error:', response.error);
        throw new Error(response.error || 'Failed to create reminder');
      }
    } catch (error) {
      console.error('🚨 Error creating reminder:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }

  /**
   * Get all reminders for the current user
   * @param {number} limit - Maximum number of reminders to fetch
   * @param {number} offset - Number of reminders to skip
   * @returns {Promise<Array>} Array of reminders
   */
  async getUserReminders(limit = 50, offset = 0) {
    try {
      const response = await ApiService.makeRequest(`/reminders?limit=${limit}&offset=${offset}`);

      if (response.success) {
        return response.data || [];
      } else {
        throw new Error(response.error || 'Failed to fetch reminders');
      }
    } catch (error) {
      console.error('Error fetching reminders:', error);
      throw error;
    }
  }

  /**
   * Get a specific reminder by ID
   * @param {string} reminderId - The reminder ID
   * @returns {Promise<Object>} The reminder data
   */
  async getReminder(reminderId) {
    try {
      const response = await ApiService.makeRequest(`/reminders/${reminderId}`);

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to fetch reminder');
      }
    } catch (error) {
      console.error('Error fetching reminder:', error);
      throw error;
    }
  }

  /**
   * Update an existing reminder
   * @param {string} reminderId - The reminder ID
   * @param {Object} updateData - The data to update
   * @returns {Promise<Object>} The updated reminder
   */
  async updateReminder(reminderId, updateData) {
    try {
      const payload = {};
      
      if (updateData.title !== undefined) {
        payload.title = updateData.title;
      }
      if (updateData.description !== undefined) {
        payload.description = updateData.description || null;
      }
      if (updateData.type !== undefined) {
        payload.reminderType = updateData.type;
      }
      if (updateData.dateTime !== undefined) {
        payload.scheduledAt = updateData.dateTime;
      }
      if (updateData.isEnabled !== undefined) {
        payload.isEnabled = updateData.isEnabled;
      }
      if (updateData.isCompleted !== undefined) {
        payload.isCompleted = updateData.isCompleted;
      }

      const response = await ApiService.makeRequest(`/reminders/${reminderId}`, {
        method: 'PUT',
        body: payload
      });

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update reminder');
      }
    } catch (error) {
      console.error('Error updating reminder:', error);
      throw error;
    }
  }

  /**
   * Delete a reminder
   * @param {string} reminderId - The reminder ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteReminder(reminderId) {
    try {
      const response = await ApiService.makeRequest(`/reminders/${reminderId}`, {
        method: 'DELETE'
      });

      if (response.success) {
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete reminder');
      }
    } catch (error) {
      console.error('Error deleting reminder:', error);
      throw error;
    }
  }

  /**
   * Toggle reminder enabled status
   * @param {string} reminderId - The reminder ID
   * @returns {Promise<Object>} The updated reminder
   */
  async toggleReminder(reminderId) {
    try {
      const response = await ApiService.makeRequest(`/reminders/${reminderId}/toggle`, {
        method: 'POST'
      });

      if (response.success) {
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to toggle reminder');
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
      throw error;
    }
  }

  /**
   * Convert backend reminder format to frontend format
   * @param {Object} backendReminder - Reminder from backend
   * @returns {Object} Frontend-formatted reminder
   */
  formatReminderForFrontend(backendReminder) {
    return {
      id: backendReminder.id,
      title: backendReminder.title,
      description: backendReminder.description,
      type: backendReminder.reminderType,
      dateTime: backendReminder.scheduledAt,
      isEnabled: backendReminder.isEnabled,
      isCompleted: backendReminder.isCompleted,
      createdAt: backendReminder.createdAt,
      updatedAt: backendReminder.updatedAt,
      notificationSent: backendReminder.notificationSent,
    };
  }

  /**
   * Convert frontend reminder format to backend format
   * @param {Object} frontendReminder - Reminder from frontend
   * @returns {Object} Backend-formatted reminder
   */
  formatReminderForBackend(frontendReminder) {
    return {
      title: frontendReminder.title,
      description: frontendReminder.description,
      reminderType: frontendReminder.type,
      scheduledAt: frontendReminder.dateTime,
      isEnabled: frontendReminder.isEnabled,
      isCompleted: frontendReminder.isCompleted,
    };
  }

  /**
   * Sync local reminders with backend (for migration purposes)
   * @param {Array} localReminders - Local reminders to sync
   * @returns {Promise<Array>} Synced reminders
   */
  async syncLocalReminders(localReminders) {
    try {
      const syncedReminders = [];
      
      for (const localReminder of localReminders) {
        try {
          // Skip if reminder is in the past and was one-time
          if (localReminder.type === 'once' && new Date(localReminder.dateTime) < new Date()) {
            continue;
          }

          const backendData = this.formatReminderForBackend(localReminder);
          const createdReminder = await this.createReminder(backendData);
          syncedReminders.push(this.formatReminderForFrontend(createdReminder));
        } catch (error) {
          console.warn('Failed to sync reminder:', localReminder.title, error);
        }
      }

      return syncedReminders;
    } catch (error) {
      console.error('Error syncing local reminders:', error);
      throw error;
    }
  }

  /**
   * Check if reminder service is available
   * @returns {Promise<boolean>} Service availability
   */
  async isServiceAvailable() {
    try {
      console.log('🔍 Checking if reminder service is available...');
      const result = await this.getUserReminders(1, 0);
      console.log('✅ Reminder service is available:', result);
      return true;
    } catch (error) {
      console.warn('❌ Reminder service not available:', error);
      console.warn('🔍 Error details:', {
        message: error.message,
        stack: error.stack
      });
      return false;
    }
  }
}

export default new ReminderService();
