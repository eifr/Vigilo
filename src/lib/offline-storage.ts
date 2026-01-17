import { openDB, type IDBPDatabase } from 'idb';

export interface MovementEvent {
  id: string;
  timestamp: number;
  deviceId: string;
  frame: string;
  metadata?: {
    motionLevel?: number;
    diffThreshold?: number;
    motionPixelRatio?: number;
  };
  createdAt: number;
  syncedAt?: number;
  retryCount?: number;
}

export interface SyncQueueItem extends MovementEvent {
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  errorMessage?: string;
}

const DB_NAME = 'vigilo_offline';
const DB_VERSION = 1;
const STORE_NAME = 'movement_events';

class OfflineStorage {
  private db: IDBPDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('deviceId', 'deviceId');
          store.createIndex('status', 'status');
          store.createIndex('createdAt', 'createdAt');
        }
      },
    });
  }

  async addMovementEvent(event: Omit<MovementEvent, 'id' | 'createdAt'>): Promise<string> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const movementEvent: MovementEvent = {
      ...event,
      id: `movement_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      createdAt: Date.now(),
    };

    const queueItem: SyncQueueItem = {
      ...movementEvent,
      status: 'pending',
    };

    await this.db.add(STORE_NAME, queueItem);
    return movementEvent.id;
  }

  async getPendingEvents(): Promise<SyncQueueItem[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex(STORE_NAME, 'status', 'pending');
  }

  async getFailedEvents(): Promise<SyncQueueItem[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex(STORE_NAME, 'status', 'failed');
  }

  async updateEventStatus(id: string, status: SyncQueueItem['status'], errorMessage?: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const event = await this.db.get(STORE_NAME, id);
    if (!event) throw new Error(`Event ${id} not found`);

    const updatedEvent: SyncQueueItem = {
      ...event,
      status,
      errorMessage: errorMessage || undefined,
      syncedAt: status === 'completed' ? Date.now() : event.syncedAt,
      retryCount: status === 'failed' ? (event.retryCount || 0) + 1 : event.retryCount,
    };

    await this.db.put(STORE_NAME, updatedEvent);
  }

  async deleteEvent(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.delete(STORE_NAME, id);
  }

  async getEventCount(): Promise<{ pending: number; failed: number; completed: number }> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const pending = await this.db.countFromIndex(STORE_NAME, 'status', 'pending');
    const failed = await this.db.countFromIndex(STORE_NAME, 'status', 'failed');
    const completed = await this.db.countFromIndex(STORE_NAME, 'status', 'completed');

    return { pending, failed, completed };
  }

  async clearCompletedEvents(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const completedEvents = await this.db.getAllFromIndex(STORE_NAME, 'status', 'completed');
    const transaction = this.db.transaction(STORE_NAME, 'readwrite');
    
    for (const event of completedEvents) {
      await transaction.store.delete(event.id);
    }
    
    await transaction.done;
  }

  async getEventsByDevice(deviceId: string, limit = 50): Promise<SyncQueueItem[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return await this.db.getAllFromIndex(STORE_NAME, 'deviceId', deviceId, limit);
  }
}

export const offlineStorage = new OfflineStorage();