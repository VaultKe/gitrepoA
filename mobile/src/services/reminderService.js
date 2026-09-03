import ApiService from './api';

class ReminderService {
  static #availabilityCache = { available: null, checkedAt: 0 };
  static #AVAILABILITY_TTL = 30000;

  async createReminder(reminderData) {
    const requestBody = {
      title: reminderData.title,
      description: reminderData.description || null,
      reminderType: reminderData.type,
      scheduledAt: reminderData.dateTime,
      isEnabled: reminderData.isEnabled,
      sound: reminderData.sound || null,
    };

    const response = await ApiService.makeRequest('/reminders', {
      method: 'POST',
      body: requestBody
    });

    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to create reminder');
  }

  async getUserReminders(limit = 50, offset = 0) {
    const response = await ApiService.makeRequest(`/reminders?limit=${limit}&offset=${offset}`);

    if (response.success) {
      return response.data || [];
    }
    throw new Error(response.error || 'Failed to fetch reminders');
  }

  async getReminder(reminderId) {
    const response = await ApiService.makeRequest(`/reminders/${reminderId}`);

    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to fetch reminder');
  }

  async updateReminder(reminderId, updateData) {
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
    if (updateData.sound !== undefined) {
      payload.sound = updateData.sound || null;
    }

    const response = await ApiService.makeRequest(`/reminders/${reminderId}`, {
      method: 'PUT',
      body: payload
    });

    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to update reminder');
  }

  async deleteReminder(reminderId) {
    const response = await ApiService.makeRequest(`/reminders/${reminderId}`, {
      method: 'DELETE'
    });

    if (response.success) {
      return true;
    }
    throw new Error(response.error || 'Failed to delete reminder');
  }

  async toggleReminder(reminderId) {
    const response = await ApiService.makeRequest(`/reminders/${reminderId}/toggle`, {
      method: 'POST'
    });

    if (response.success) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to toggle reminder');
  }

  formatReminderForFrontend(backendReminder) {
    return {
      id: backendReminder.id,
      title: backendReminder.title,
      description: backendReminder.description,
      type: backendReminder.reminderType,
      dateTime: backendReminder.scheduledAt,
      isEnabled: backendReminder.isEnabled,
      isCompleted: backendReminder.isCompleted,
      sound: backendReminder.sound || 'default',
      createdAt: backendReminder.createdAt,
      updatedAt: backendReminder.updatedAt,
      notificationSent: backendReminder.notificationSent,
    };
  }

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

  async syncLocalReminders(localReminders) {
    const syncedReminders = [];

    for (const localReminder of localReminders) {
      try {
        if (localReminder.type === 'once' && new Date(localReminder.dateTime) < new Date()) {
          continue;
        }

        const backendData = this.formatReminderForBackend(localReminder);
        const createdReminder = await this.createReminder(backendData);
        syncedReminders.push(this.formatReminderForFrontend(createdReminder));
      } catch {}
    }

    return syncedReminders;
  }

  async isServiceAvailable() {
    const now = Date.now();
    if (ReminderService.#availabilityCache.available !== null &&
        now - ReminderService.#availabilityCache.checkedAt < ReminderService.#AVAILABILITY_TTL) {
      return ReminderService.#availabilityCache.available;
    }

    try {
      await this.getUserReminders(1, 0);
      ReminderService.#availabilityCache = { available: true, checkedAt: now };
      return true;
    } catch {
      ReminderService.#availabilityCache = { available: false, checkedAt: now };
      return false;
    }
  }
}

export default new ReminderService();