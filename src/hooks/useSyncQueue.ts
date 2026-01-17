import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { useConnectivity } from './useConnectivity';
import { offlineStorage, type SyncQueueItem } from '../lib/offline-storage';

export interface SyncStatus {
  isSyncing: boolean;
  isFlushing: boolean;
  pendingCount: number;
  failedCount: number;
  lastSyncTime: number | null;
  syncProgress: number;
  totalToSync: number;
  wasOffline: boolean;
}

export interface UseSyncQueueOptions {
  telegramBotToken: string;
  telegramChatId: string;
  maxRetries?: number;
  syncBatchSize?: number;
  retryDelay?: number;
  debounceTime?: number;
}

export function useSyncQueue(options: UseSyncQueueOptions) {
  const { isOnline } = useConnectivity();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    isFlushing: false,
    pendingCount: 0,
    failedCount: 0,
    lastSyncTime: null,
    syncProgress: 0,
    totalToSync: 0,
    wasOffline: false,
  });

  const syncInProgress = useRef(false);
  const abortController = useRef<AbortController | null>(null);
  const wasOffline = useRef(false);

  const {
    telegramBotToken,
    telegramChatId,
    maxRetries = 3,
    syncBatchSize = 5,
  } = options;

  const updateSyncStatus = useCallback(async () => {
    try {
      const counts = await offlineStorage.getEventCount();
      setSyncStatus(prev => ({
        ...prev,
        pendingCount: counts.pending,
        failedCount: counts.failed,
        wasOffline: wasOffline.current,
      }));
    } catch (error) {
      console.error('Error updating sync status:', error);
    }
  }, []);

  const dataUrlToBlob = useCallback(async (dataUrl: string): Promise<Blob | null> => {
    try {
      console.log('Processing data URL, length:', dataUrl.length);
      
      // Extract the Base64 data and MIME type
      const matches = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        console.error('Invalid data URL format:', dataUrl.substring(0, 100) + '...');
        return null;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];

      console.log('MIME type:', mimeType, 'Base64 length:', base64Data.length);

      // Validate Base64 format and remove any whitespace
      const cleanBase64 = base64Data.replace(/\s/g, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanBase64)) {
        console.error('Invalid Base64 format - contains invalid characters');
        console.log('First 100 chars:', cleanBase64.substring(0, 100));
        return null;
      }

      // Convert Base64 to binary
      const byteString = atob(cleanBase64);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }

      console.log('ArrayBuffer size:', arrayBuffer.byteLength, 'bytes');

      // Check size (Telegram limit is 10MB for photos)
      if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
        console.error('Image too large for Telegram:', arrayBuffer.byteLength, 'bytes');
        return null;
      }

      return new Blob([arrayBuffer], { type: mimeType });
    } catch (error) {
      console.error('Error converting data URL to Blob:', error);
      return null;
    }
  }, []);

  const sendTelegramMessage = useCallback(async (frame: string, originalTimestamp?: number): Promise<boolean> => {
    try {
      const captionTime = originalTimestamp 
        ? new Date(originalTimestamp).toLocaleString()
        : new Date().toLocaleString();

      console.log('Sending Telegram message with frame length:', frame.length);

      // Convert data URL to Blob for FormData upload
      const imageBlob = await dataUrlToBlob(frame);
      
      if (!imageBlob) {
        console.error('Failed to process image, falling back to text message');
        
        // Fallback to text message if image processing fails
        const textResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: `🚨 Motion detected at ${captionTime}\n\n(Unable to send image - data corrupted)`,
          }),
        });

        return textResponse.ok;
      }

      console.log('Image blob created, size:', imageBlob.size, 'type:', imageBlob.type);

      // Create FormData with the image blob
      const formData = new FormData();
      formData.append('chat_id', telegramChatId);
      formData.append('photo', imageBlob, `motion_${Date.now()}.jpg`);
      formData.append('caption', `🚨 Motion detected at ${captionTime}`);

      const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
        method: 'POST',
        body: formData,
      });

      console.log('Telegram FormData response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Telegram API error:', errorData);
        
        // If file upload fails, try with a smaller, recompressed image
        if (errorData.description?.includes('photo') || 
            errorData.description?.includes('file') ||
            errorData.description?.includes('Bad Request') ||
            response.status === 400) {
          
          console.log('File upload failed, trying with smaller image');
          
          // Try to create an even smaller version
          const smallerBlob = await dataUrlToBlob(frame.replace(/quality=[0-9.]+/, 'quality=0.3'));
          if (smallerBlob && smallerBlob.size < imageBlob.size) {
            const retryFormData = new FormData();
            retryFormData.append('chat_id', telegramChatId);
            retryFormData.append('photo', smallerBlob, `motion_${Date.now()}_small.jpg`);
            retryFormData.append('caption', `🚨 Motion detected at ${captionTime}`);

            const retryResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendPhoto`, {
              method: 'POST',
              body: retryFormData,
            });

            if (retryResponse.ok) {
              console.log('Smaller image upload successful');
              return true;
            }
          }
          
          console.log('All image attempts failed, sending text only');
          const fallbackTextResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: `🚨 Motion detected at ${captionTime}\n\n(Image upload failed - technical issues)`,
            }),
          });

          return fallbackTextResponse.ok;
        } else {
          throw new Error(`Telegram API error: ${response.status} - ${errorData.description || 'Unknown error'}`);
        }
      }

      return true;
    } catch (error) {
      console.error('Error sending Telegram message:', error);
      
      // Final fallback - send text only
      try {
        const captionTime = originalTimestamp 
          ? new Date(originalTimestamp).toLocaleString()
          : new Date().toLocaleString();

        const fallbackResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: `🚨 Motion detected at ${captionTime}\n\n(Image upload failed)`,
          }),
        });

        return fallbackResponse.ok;
      } catch (fallbackError) {
        console.error('Fallback text message also failed:', fallbackError);
        return false;
      }
    }
  }, [telegramBotToken, telegramChatId, dataUrlToBlob]);

  const tryImmediateSend = useCallback(async (frame: string, originalTimestamp: number): Promise<boolean> => {
    if (!isOnline) {
      return false;
    }

    try {
      return await sendTelegramMessage(frame, originalTimestamp);
    } catch (error) {
      // Only treat as failure if it's a network-related error
      if (error instanceof Error && (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('Failed to fetch')
      )) {
        return false;
      }
      throw error; // Re-throw non-network errors
    }
  }, [isOnline, sendTelegramMessage]);

  const queueEventOffline = useCallback(async (deviceId: string, frame: string, timestamp: number, metadata?: any): Promise<string> => {
    return await offlineStorage.addMovementEvent({
      deviceId,
      frame,
      timestamp,
      metadata,
    });
  }, []);

  const syncEvent = useCallback(async (event: SyncQueueItem): Promise<boolean> => {
    try {
      await offlineStorage.updateEventStatus(event.id, 'syncing');

      const success = await sendTelegramMessage(event.frame);

      if (success) {
        await offlineStorage.updateEventStatus(event.id, 'completed');
        return true;
      } else {
        throw new Error('Failed to send Telegram message');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const retryCount = event.retryCount || 0;

      if (retryCount >= maxRetries) {
        await offlineStorage.updateEventStatus(event.id, 'failed', errorMessage);
      } else {
        await offlineStorage.updateEventStatus(event.id, 'pending', errorMessage);
      }

      return false;
    }
  }, [sendTelegramMessage, maxRetries]);

  const flushQueue = useCallback(async (): Promise<void> => {
    if (syncInProgress.current || !isOnline) {
      return;
    }

    syncInProgress.current = true;
    abortController.current = new AbortController();

    try {
      const pendingEvents = await offlineStorage.getPendingEvents();
      
      if (pendingEvents.length === 0) {
        setSyncStatus(prev => ({ ...prev, wasOffline: false }));
        wasOffline.current = false;
        return;
      }

      setSyncStatus(prev => ({
        ...prev,
        isFlushing: true,
        syncProgress: 0,
        totalToSync: pendingEvents.length,
      }));

      let successfulFlushes = 0;

      for (const event of pendingEvents) {
        if (abortController.current?.signal.aborted) {
          break;
        }

        try {
          await offlineStorage.updateEventStatus(event.id, 'syncing');
          
          const success = await sendTelegramMessage(event.frame, event.timestamp);
          
          if (success) {
            await offlineStorage.deleteEvent(event.id);
            successfulFlushes++;
          } else {
            await offlineStorage.updateEventStatus(event.id, 'failed', 'Failed to send during flush');
          }

          setSyncStatus(prev => ({
            ...prev,
            syncProgress: prev.syncProgress + 1,
          }));

          // Add small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error flushing event ${event.id}:`, error);
          await offlineStorage.updateEventStatus(event.id, 'pending', 'Flush interrupted');
        }
      }

      setSyncStatus(prev => ({
        ...prev,
        isFlushing: false,
        lastSyncTime: Date.now(),
        syncProgress: 0,
        totalToSync: 0,
        wasOffline: false,
      }));

      wasOffline.current = false;
      await updateSyncStatus();

    } catch (error) {
      console.error('Error during flush:', error);
      setSyncStatus(prev => ({
        ...prev,
        isFlushing: false,
        syncProgress: 0,
        totalToSync: 0,
      }));
    } finally {
      syncInProgress.current = false;
      abortController.current = null;
    }
  }, [isOnline, sendTelegramMessage, updateSyncStatus]);

  const syncEvents = useCallback(async (events: SyncQueueItem[]): Promise<number> => {
    let successfulSyncs = 0;

    for (const event of events) {
      if (abortController.current?.signal.aborted) {
        break;
      }

      try {
        const success = await syncEvent(event);
        if (success) {
          successfulSyncs++;
        }

        setSyncStatus(prev => ({
          ...prev,
          syncProgress: prev.syncProgress + 1,
        }));

        // Add small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error syncing event ${event.id}:`, error);
      }
    }

    return successfulSyncs;
  }, [syncEvent]);

  const startSync = useCallback(async (): Promise<void> => {
    if (syncInProgress.current || !isOnline) {
      return;
    }

    syncInProgress.current = true;
    abortController.current = new AbortController();

    try {
      const pendingEvents = await offlineStorage.getPendingEvents();
      
      if (pendingEvents.length === 0) {
        return;
      }

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: true,
        syncProgress: 0,
        totalToSync: pendingEvents.length,
      }));

      // Process events in batches
      const batches: SyncQueueItem[][] = [];
      for (let i = 0; i < pendingEvents.length; i += syncBatchSize) {
        batches.push(pendingEvents.slice(i, i + syncBatchSize));
      }

      let totalSuccessful = 0;

      for (const batch of batches) {
        if (abortController.current?.signal.aborted) {
          break;
        }

        const successful = await syncEvents(batch);
        totalSuccessful += successful;

        // Add delay between batches
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: Date.now(),
        syncProgress: 0,
        totalToSync: 0,
      }));

      await updateSyncStatus();

      // Clean up completed events older than 24 hours
      await offlineStorage.clearCompletedEvents();

    } catch (error) {
      console.error('Error during sync:', error);
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncProgress: 0,
        totalToSync: 0,
      }));
    } finally {
      syncInProgress.current = false;
      abortController.current = null;
    }
  }, [isOnline, syncBatchSize, syncEvents, updateSyncStatus]);

  const stopSync = useCallback((): void => {
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);

  const retryFailedEvents = useCallback(async (): Promise<void> => {
    try {
      const failedEvents = await offlineStorage.getFailedEvents();
      
      for (const event of failedEvents) {
        if ((event.retryCount || 0) < maxRetries) {
          await offlineStorage.updateEventStatus(event.id, 'pending');
        }
      }

      await updateSyncStatus();
      await startSync();
    } catch (error) {
      console.error('Error retrying failed events:', error);
    }
  }, [maxRetries, updateSyncStatus, startSync]);

  const clearFailedEvents = useCallback(async (): Promise<void> => {
    try {
      const failedEvents = await offlineStorage.getFailedEvents();
      
      for (const event of failedEvents) {
        await offlineStorage.deleteEvent(event.id);
      }

      await updateSyncStatus();
    } catch (error) {
      console.error('Error clearing failed events:', error);
    }
  }, [updateSyncStatus]);

  // Track offline state transitions and trigger flush
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setSyncStatus(prev => ({ ...prev, wasOffline: true }));
    } else if (isOnline && wasOffline.current && syncStatus.pendingCount > 0 && !syncStatus.isFlushing) {
      // Just came online, trigger flush
      const timer = setTimeout(() => {
        flushQueue();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, syncStatus.pendingCount, syncStatus.isFlushing, flushQueue]);

  // Update sync status periodically
  useEffect(() => {
    updateSyncStatus();

    const interval = setInterval(updateSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [updateSyncStatus]);

  return {
    syncStatus,
    tryImmediateSend,
    queueEventOffline,
    flushQueue,
    startSync,
    stopSync,
    retryFailedEvents,
    clearFailedEvents,
    updateSyncStatus,
  };
}