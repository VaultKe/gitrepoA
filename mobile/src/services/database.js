class DatabaseService {
  async initialize() {
    // No local database initialization needed - rely entirely on backend
    return true;
  }

  async insert(table, data) {
    // Route all insert operations to backend API
    const ApiService = (await import('./api')).default;
    
    // Map table names to appropriate API endpoints
    const endpointMap = {
      users: '/users',
      chamas: '/chamas',
      chama_members: '/chama-members',
      wallets: '/wallets',
      transactions: '/transactions',
      notifications: '/notifications',
      chat_rooms: '/wa/chat/rooms',
      chat_messages: '/wa/chat/rooms',
      loans: '/loans',
      sync_queue: '/sync' // Special handling for sync operations
    };

    const endpoint = endpointMap[table] || `/${table}`;
    const response = await ApiService.makeRequest(endpoint, {
      method: 'POST',
      body: data
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to insert data');
    }

    return response.data;
  }

  async update(table, id, data) {
    // Route all update operations to backend API
    const ApiService = (await import('./api')).default;
    
    // Map table names to appropriate API endpoints
    const endpointMap = {
      users: `/users/${id}`,
      chamas: `/chamas/${id}`,
      chama_members: `/chama-members/${id}`,
      wallets: `/wallets/${id}`,
      transactions: `/transactions/${id}`,
      notifications: `/notifications/${id}`,
      chat_rooms: `/wa/chat/rooms/${id}`,
      chat_messages: `/wa/chat/rooms/${id}`,
      loans: `/loans/${id}`,
      sync_queue: `/sync/${id}` // Special handling for sync operations
    };

    const endpoint = endpointMap[table] || `/${table}/${id}`;
    const response = await ApiService.makeRequest(endpoint, {
      method: 'PUT',
      body: data
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to update data');
    }

    return response.data;
  }

  async insertOrUpdate(table, data, idField = 'id') {
    // For insertOrUpdate, we'll attempt update first, then insert if not found
    const id = data[idField];
    if (!id) {
      // No ID provided, just insert
      return await this.insert(table, data);
    }

    try {
      // Try to update first
      return await this.update(table, id, data);
    } catch (error) {
      // If update fails (likely because record doesn't exist), insert instead
      return await this.insert(table, data);
    }
  }

  async delete(table, id) {
    // Route all delete operations to backend API
    const ApiService = (await import('./api')).default;
    
    // Map table names to appropriate API endpoints
    const endpointMap = {
      users: `/users/${id}`,
      chamas: `/chamas/${id}`,
      chama_members: `/chama-members/${id}`,
      wallets: `/wallets/${id}`,
      transactions: `/transactions/${id}`,
      notifications: `/notifications/${id}`,
      chat_rooms: `/wa/chat/rooms/${id}`,
      chat_messages: `/wa/chat/rooms/${id}`,
      loans: `/loans/${id}`,
      sync_queue: `/sync/${id}` // Special handling for sync operations
    };

    const endpoint = endpointMap[table] || `/${table}/${id}`;
    const response = await ApiService.makeRequest(endpoint, {
      method: 'DELETE'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to delete data');
    }

    return response.data;
  }

  async findById(table, id) {
    // Route all findById operations to backend API
    const ApiService = (await import('./api')).default;
    
    // Map table names to appropriate API endpoints
    const endpointMap = {
      users: `/users/${id}`,
      chamas: `/chamas/${id}`,
      chama_members: `/chama-members/${id}`,
      wallets: `/wallets/${id}`,
      transactions: `/transactions/${id}`,
      notifications: `/notifications/${id}`,
      chat_rooms: `/wa/chat/rooms/${id}`,
      chat_messages: `/wa/chat/rooms/${id}`,
      loans: `/loans/${id}`,
      sync_queue: `/sync/${id}` // Special handling for sync operations
    };

    const endpoint = endpointMap[table] || `/${table}/${id}`;
    const response = await ApiService.makeRequest(endpoint, {
      method: 'GET'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch data');
    }

    return response.data;
  }

  async findAll(table, where = '', params = [], orderBy = 'created_at DESC', limit = null) {
    // Route all findAll operations to backend API
    const ApiService = (await import('./api')).default;
    
    // Map table names to appropriate API endpoints
    const endpointMap = {
      users: '/users',
      chamas: '/chamas',
      chama_members: '/chama-members',
      wallets: '/wallets',
      transactions: '/transactions',
      notifications: '/notifications',
      chat_rooms: '/wa/chat/rooms',
      chat_messages: '/wa/chat/rooms',
      loans: '/loans',
      sync_queue: '/sync' // Special handling for sync operations
    };

    const endpoint = endpointMap[table] || `/${table}`;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (where) {
      queryParams.append('where', where);
    }
    if (params.length > 0) {
      queryParams.append('params', JSON.stringify(params));
    }
    if (orderBy) {
      queryParams.append('orderBy', orderBy);
    }
    if (limit) {
      queryParams.append('limit', limit.toString());
    }
    
    const url = `${endpoint}?${queryParams.toString()}`;
    const response = await ApiService.makeRequest(url, {
      method: 'GET'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch data list');
    }

    return response.data || [];
  }

  async addToSyncQueue(tableName, operation, recordId, data = null) {
    // Sync queue operations go to backend sync endpoint
    const ApiService = (await import('./api')).default;
    
    const queueData = {
      table_name: tableName,
      operation,
      record_id: recordId.toString(),
      data: data ? JSON.stringify(data) : null
    };

    const response = await ApiService.makeRequest('/sync', {
      method: 'POST',
      body: queueData
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to add to sync queue');
    }

    return response.data;
  }

  async getSyncQueue(limit = 50) {
    // Get sync queue from backend
    const ApiService = (await import('./api')).default;
    
    const response = await ApiService.makeRequest(`/sync?limit=${limit}`, {
      method: 'GET'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get sync queue');
    }

    return response.data || [];
  }

  async markSyncComplete(queueId) {
    // Mark sync complete via backend
    const ApiService = (await import('./api')).default;
    
    const response = await ApiService.makeRequest(`/sync/${queueId}/complete`, {
      method: 'POST'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to mark sync complete');
    }

    return response.data;
  }

  async markSyncFailed(queueId, errorMessage) {
    // Mark sync failed via backend
    const ApiService = (await import('./api')).default;
    
    const response = await ApiService.makeRequest(`/sync/${queueId}/failed`, {
      method: 'POST',
      body: { error_message: errorMessage }
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to mark sync failed');
    }

    return response.data;
  }

  async clearAllData() {
    // Clear all data via backend (this would typically be a logout operation)
    const ApiService = (await import('./api')).default;
    
    const response = await ApiService.makeRequest('/auth/logout', {
      method: 'POST'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to clear data');
    }

    return response.data;
  }

  async getStats() {
    // Get statistics from backend
    const ApiService = (await import('./api')).default;
    
    const response = await ApiService.makeRequest('/stats', {
      method: 'GET'
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get stats');
    }

    return response.data || {};
  }
}

export default new DatabaseService();