import { Platform } from 'react-native';

// Platform-specific imports
let SQLite = null;
if (Platform.OS !== 'web') {
  SQLite = require('expo-sqlite');
}

class DatabaseService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.isWeb = Platform.OS === 'web';
    this.memoryStorage = new Map(); // Fallback for web
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      if (this.isWeb) {
        // Web fallback - use memory storage
        this.isInitialized = true;
        return;
      }

      if (!SQLite) {
        throw new Error('SQLite not available on this platform');
      }

      this.db = await SQLite.openDatabaseAsync('vaultke.db');

      await this.createEssentialTables();

      this.isInitialized = true;

      // Create remaining tables in background
      setTimeout(() => this.createRemainingTables(), 100);
    } catch (error) {
      throw error;
    }
  }

  async createEssentialTables() {
    // Only create the most essential tables first for fast initialization
    const essentialTables = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT,
        phone TEXT,
        first_name TEXT,
        last_name TEXT,
        avatar TEXT,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        language TEXT DEFAULT 'en',
        theme TEXT DEFAULT 'dark',
        county TEXT,
        town TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0
      )`,

      // Sync queue table for offline operations
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0
      )`
    ];

    for (const tableSQL of essentialTables) {
      await this.db.execAsync(tableSQL);
    }
  }

  async createRemainingTables() {
    if (!this.isInitialized) return;

    // Skip for web platform
    if (this.isWeb) {
      return;
    }

    try {
      const remainingTables = [
      // Chamas table
      `CREATE TABLE IF NOT EXISTS chamas (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        avatar TEXT,
        county TEXT NOT NULL,
        town TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        contribution_amount REAL NOT NULL,
        contribution_frequency TEXT NOT NULL,
        max_members INTEGER,
        current_members INTEGER DEFAULT 0,
        total_funds REAL DEFAULT 0,
        is_public BOOLEAN DEFAULT 1,
        requires_approval BOOLEAN DEFAULT 0,
        rules TEXT,
        meeting_schedule TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0
      )`,

      // Chama members table
      `CREATE TABLE IF NOT EXISTS chama_members (
        id TEXT PRIMARY KEY,
        chama_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 1,
        total_contributions REAL DEFAULT 0,
        last_contribution DATETIME,
        rating REAL DEFAULT 0,
        total_ratings INTEGER DEFAULT 0,
        synced BOOLEAN DEFAULT 0,
        FOREIGN KEY (chama_id) REFERENCES chamas(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // Wallets table
      `CREATE TABLE IF NOT EXISTS wallets (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        balance REAL DEFAULT 0,
        currency TEXT DEFAULT 'KES',
        is_active BOOLEAN DEFAULT 1,
        is_locked BOOLEAN DEFAULT 0,
        daily_limit REAL,
        monthly_limit REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0
      )`,

      // Transactions table
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        from_wallet_id TEXT,
        to_wallet_id TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'KES',
        description TEXT,
        reference TEXT,
        payment_method TEXT NOT NULL,
        metadata TEXT,
        fees REAL DEFAULT 0,
        initiated_by TEXT NOT NULL,
        approved_by TEXT,
        requires_approval BOOLEAN DEFAULT 0,
        approval_deadline DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0
      )`,

      // Notifications table
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        is_read BOOLEAN DEFAULT 0,
        is_push BOOLEAN DEFAULT 0,
        is_email BOOLEAN DEFAULT 0,
        is_sms BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME,
        synced BOOLEAN DEFAULT 0
      )`,

      // Chat rooms table
      `CREATE TABLE IF NOT EXISTS chat_rooms (
        id TEXT PRIMARY KEY,
        name TEXT,
        type TEXT NOT NULL,
        chama_id TEXT,
        created_by TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 1,
        last_message TEXT,
        last_message_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0
      )`,

      // Chat messages table
      `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'text',
        content TEXT NOT NULL,
        metadata TEXT,
        is_edited BOOLEAN DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        reply_to_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0,
        FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )`,

      // Loans table
      `CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        borrower_id TEXT NOT NULL,
        chama_id TEXT NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        interest_rate REAL DEFAULT 0,
        duration INTEGER NOT NULL,
        purpose TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at DATETIME,
        disbursed_at DATETIME,
        due_date DATETIME,
        total_amount REAL DEFAULT 0,
        paid_amount REAL DEFAULT 0,
        remaining_amount REAL DEFAULT 0,
        required_guarantors INTEGER NOT NULL,
        approved_guarantors INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        synced BOOLEAN DEFAULT 0
      )`,

      // Sync queue table for offline operations
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        operation TEXT NOT NULL,
        record_id TEXT NOT NULL,
        data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        last_attempt DATETIME,
        error_message TEXT
      )`
    ];

      for (const tableSQL of remainingTables) {
        await this.db.execAsync(tableSQL);
      }
      console.log('Remaining tables created successfully');
    } catch (error) {
      console.error('Error creating remaining tables:', error);
      // Don't throw - app should continue working with essential tables
    }
  }

  // Generic CRUD operations with fallback
  async insert(table, data) {
    if (!this.isInitialized) {
      console.warn(`Database not initialized, skipping insert to ${table}`);
      return { success: false, error: 'Database not initialized' };
    }

    if (this.isWeb) {
      // Web fallback - use memory storage
      const key = `${table}_${data.id || Date.now()}`;
      this.memoryStorage.set(key, { ...data, table });
      return { success: true, insertId: key };
    }

    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);

    const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;

    try {
      const result = await this.db.runAsync(sql, values);

      // Add to sync queue if not already synced
      if (!data.synced && table !== 'sync_queue') {
        try {
          await this.addToSyncQueue(table, 'INSERT', data.id || result.lastInsertRowId, data);
        } catch (syncError) {
          console.warn('Failed to add to sync queue:', syncError);
        }
      }

      return result;
    } catch (error) {
      console.error(`Error inserting into ${table}:`, error);
      return { success: false, error: error.message };
    }
  }

  async update(table, id, data) {
    if (!this.isInitialized) await this.initialize();

    if (this.isWeb) {
      // Web fallback - update memory storage
      for (const [key, value] of this.memoryStorage.entries()) {
        if (value.table === table && value.id === id) {
          const updatedValue = { ...value, ...data, updated_at: new Date().toISOString() };
          this.memoryStorage.set(key, updatedValue);
          return { success: true, changes: 1 };
        }
      }
      return { success: false, changes: 0 };
    }

    if (!this.db) {
      console.warn(`Database not available for update in ${table}`);
      return { success: false, changes: 0 };
    }

    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];

    const sql = `UPDATE ${table} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

    try {
      const result = await this.db.runAsync(sql, values);

      // Add to sync queue
      await this.addToSyncQueue(table, 'UPDATE', id, data);

      return result;
    } catch (error) {
      console.error(`Error updating ${table}:`, error);
      throw error;
    }
  }

  async insertOrUpdate(table, data, idField = 'id') {
    if (!this.isInitialized) {
      console.warn(`Database not initialized, skipping insertOrUpdate to ${table}`);
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const id = data[idField];
      if (!id) {
        // No ID provided, just insert
        return await this.insert(table, data);
      }

      // Check if record exists
      const existing = await this.findById(table, id);
      if (existing) {
        // Update existing record
        return await this.update(table, id, data);
      } else {
        // Insert new record
        return await this.insert(table, data);
      }
    } catch (error) {
      console.error(`Error in insertOrUpdate for ${table}:`, error);
      return { success: false, error: error.message };
    }
  }

  async delete(table, id) {
    if (!this.isInitialized) await this.initialize();

    const sql = `DELETE FROM ${table} WHERE id = ?`;

    try {
      const result = await this.db.runAsync(sql, [id]);

      // Add to sync queue
      await this.addToSyncQueue(table, 'DELETE', id);

      return result;
    } catch (error) {
      console.error(`Error deleting from ${table}:`, error);
      throw error;
    }
  }

  async deleteWhere(table, whereClause, params = []) {
    if (!this.isInitialized) await this.initialize();

    if (this.isWeb) {
      // Web fallback - remove from memory storage
      const keysToDelete = [];
      for (const [key, value] of this.memoryStorage.entries()) {
        if (value.table === table) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.memoryStorage.delete(key));
      return { success: true, changes: keysToDelete.length };
    }

    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;

    try {
      const result = await this.db.runAsync(sql, params);

      // Note: For bulk deletes, we don't add to sync queue as it would be too many entries
      // The sync service should handle bulk operations differently

      return result;
    } catch (error) {
      console.error(`Error deleting from ${table} with where clause:`, error);
      throw error;
    }
  }

  async findById(table, id) {
    if (!this.isInitialized) await this.initialize();

    if (this.isWeb) {
      // Web fallback - search memory storage
      for (const [key, value] of this.memoryStorage.entries()) {
        if (value.table === table && value.id === id) {
          return value;
        }
      }
      return null;
    }

    if (!this.db) {
      console.warn(`Database not available for findById in ${table}`);
      return null;
    }

    const sql = `SELECT * FROM ${table} WHERE id = ?`;

    try {
      const result = await this.db.getFirstAsync(sql, [id]);
      return result;
    } catch (error) {
      console.error(`Error finding by id in ${table}:`, error);
      return null; // Return null instead of throwing
    }
  }

  async findAll(table, where = '', params = [], orderBy = 'created_at DESC', limit = null) {
    if (!this.isInitialized) await this.initialize();

    if (this.isWeb) {
      // Web fallback - filter memory storage
      const results = [];
      for (const [key, value] of this.memoryStorage.entries()) {
        if (value.table === table) {
          results.push(value);
        }
      }
      return results;
    }

    let sql = `SELECT * FROM ${table}`;
    if (where) sql += ` WHERE ${where}`;
    if (orderBy) sql += ` ORDER BY ${orderBy}`;
    if (limit) sql += ` LIMIT ${limit}`;

    try {
      const result = await this.db.getAllAsync(sql, params);
      return result;
    } catch (error) {
      console.error(`Error finding all in ${table}:`, error);
      return []; // Return empty array instead of throwing
    }
  }

  // Sync queue operations
  async addToSyncQueue(tableName, operation, recordId, data = null) {
    const queueData = {
      table_name: tableName,
      operation,
      record_id: recordId.toString(),
      data: data ? JSON.stringify(data) : null,
    };

    await this.insert('sync_queue', queueData);
  }

  async getSyncQueue(limit = 50) {
    return await this.findAll('sync_queue', 'attempts < 3', [], 'created_at ASC', limit);
  }

  async markSyncComplete(queueId) {
    await this.delete('sync_queue', queueId);
  }

  async markSyncFailed(queueId, errorMessage) {
    await this.update('sync_queue', queueId, {
      attempts: 'attempts + 1',
      last_attempt: new Date().toISOString(),
      error_message: errorMessage,
    });
  }

  // Clear all data (for logout)
  async clearAllData() {
    if (!this.isInitialized) await this.initialize();

    const tables = [
      'users', 'chamas', 'chama_members', 'wallets', 'transactions',
      'notifications',
      'chat_rooms', 'chat_messages', 'loans', 'sync_queue'
    ];

    for (const table of tables) {
      await this.db.execAsync(`DELETE FROM ${table}`);
    }
  }

  // Get database statistics
  async getStats() {
    if (!this.isInitialized) await this.initialize();

    const stats = {};
    const tables = [
      'users', 'chamas', 'chama_members', 'wallets', 'transactions',
      'notifications',
      'chat_rooms', 'chat_messages', 'loans'
    ];

    for (const table of tables) {
      const result = await this.db.getFirstAsync(`SELECT COUNT(*) as count FROM ${table}`);
      stats[table] = result.count;
    }

    const unsyncedResult = await this.db.getFirstAsync(
      `SELECT COUNT(*) as count FROM sync_queue WHERE attempts < 3`
    );
    stats.unsynced_items = unsyncedResult.count;

    return stats;
  }
}

export default new DatabaseService();
