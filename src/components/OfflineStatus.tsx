import { motion } from 'motion/react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useConnectivity } from '../hooks/useConnectivity';
import type { SyncStatus } from '../hooks/useSyncQueue';

interface OfflineStatusBannerProps {
  syncStatus: SyncStatus;
  onRetrySync?: () => void;
  onClearFailed?: () => void;
}

export function OfflineStatusBanner({ 
  syncStatus, 
  onRetrySync, 
  onClearFailed 
}: OfflineStatusBannerProps) {
  const { isOnline, isOffline } = useConnectivity();

  if (isOnline && syncStatus.pendingCount === 0 && syncStatus.failedCount === 0) {
    return null;
  }

  const getStatusColor = () => {
    if (isOffline) return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    if (syncStatus.isSyncing) return 'bg-blue-50 border-blue-200 text-blue-800';
    if (syncStatus.failedCount > 0) return 'bg-red-50 border-red-200 text-red-800';
    return 'bg-green-50 border-green-200 text-green-800';
  };

  const getStatusIcon = () => {
    if (isOffline) return <WifiOff className="w-4 h-4" />;
    if (syncStatus.isSyncing) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (syncStatus.failedCount > 0) return <AlertTriangle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline Mode';
    if (syncStatus.isFlushing) return `You were offline. Syncing ${syncStatus.pendingCount} missed events...`;
    if (syncStatus.isSyncing) return `Syncing... (${syncStatus.syncProgress}/${syncStatus.totalToSync})`;
    if (syncStatus.failedCount > 0) return `${syncStatus.failedCount} Failed Events`;
    if (syncStatus.pendingCount > 0 && syncStatus.wasOffline) return 'Back Online - Queued events ready';
    return 'Sync Complete';
  };

  const getSubtext = () => {
    if (isOffline) return `${syncStatus.pendingCount} events queued for sync`;
    if (syncStatus.isFlushing) return `Sending missed events from offline period (${syncStatus.syncProgress}/${syncStatus.totalToSync})`;
    if (syncStatus.isSyncing) return 'Sending queued events to server';
    if (syncStatus.failedCount > 0) return 'Some events failed to sync';
    if (syncStatus.pendingCount > 0 && syncStatus.wasOffline) return `${syncStatus.pendingCount} events will be sent when connection is stable`;
    return syncStatus.lastSyncTime ? `Last sync: ${new Date(syncStatus.lastSyncTime).toLocaleTimeString()}` : '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full"
    >
      <Card className={`${getStatusColor()} border`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <div className="font-medium">{getStatusText()}</div>
                {getSubtext() && (
                  <div className="text-sm opacity-75">{getSubtext()}</div>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {syncStatus.failedCount > 0 && onRetrySync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetrySync}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              )}
              
              {syncStatus.failedCount > 0 && onClearFailed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearFailed}
                  className="text-xs"
                >
                  Clear Failed
                </Button>
              )}
              
              {isOnline && syncStatus.pendingCount > 0 && !syncStatus.isSyncing && !syncStatus.isFlushing && onRetrySync && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetrySync}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  {syncStatus.wasOffline ? 'Sync Now' : 'Retry'}
                </Button>
              )}
            </div>
          </div>
          
          {syncStatus.isSyncing && (
            <div className="mt-3">
              <div className="w-full bg-white/30 rounded-full h-2">
                <motion.div
                  className="bg-white h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ 
                    width: `${(syncStatus.syncProgress / syncStatus.totalToSync) * 100}%` 
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface ConnectionStatusIndicatorProps {
  className?: string;
}

export function ConnectionStatusIndicator({ className = '' }: ConnectionStatusIndicatorProps) {
  const { isOnline, effectiveType } = useConnectivity();

  if (isOnline) {
    return (
      <div className={`flex items-center gap-2 text-green-600 ${className}`}>
        <Wifi className="w-4 h-4" />
        <span className="text-xs">Online</span>
        {effectiveType && (
          <span className="text-xs opacity-75">({effectiveType})</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-yellow-600 ${className}`}>
      <WifiOff className="w-4 h-4" />
      <span className="text-xs">Offline</span>
    </div>
  );
}

interface SyncStatusCardProps {
  syncStatus: SyncStatus;
  className?: string;
}

export function SyncStatusCard({ syncStatus, className = '' }: SyncStatusCardProps) {
  const { isOnline } = useConnectivity();

  return (
    <Card className={`${className}`}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Sync Status</h3>
            <ConnectionStatusIndicator />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Pending</div>
              <div className="font-medium">{syncStatus.pendingCount}</div>
            </div>
            
            <div>
              <div className="text-muted-foreground">Failed</div>
              <div className="font-medium text-red-600">{syncStatus.failedCount}</div>
            </div>
          </div>
          
          {syncStatus.lastSyncTime && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Last sync: {new Date(syncStatus.lastSyncTime).toLocaleString()}
            </div>
          )}
          
          {!isOnline && (
            <div className="flex items-center gap-2 text-xs text-yellow-600">
              <WifiOff className="w-3 h-3" />
              Offline - Events will queue until connection is restored
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}