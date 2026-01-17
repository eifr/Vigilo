import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Database, 
  Upload, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Trash2,
  BarChart3,
  Activity,
  Shield
} from 'lucide-react';
import { useSyncQueue } from '../hooks/useSyncQueue';
import { useConnectivity } from '../hooks/useConnectivity';

interface SyncManagerProps {
  telegramBotToken: string;
  telegramChatId: string;
}

export function SyncManager({ telegramBotToken, telegramChatId }: SyncManagerProps) {
  const { isOnline } = useConnectivity();
  const {
    syncStatus,
    tryImmediateSend,
    queueEventOffline,
    flushQueue,
    retryFailedEvents,
    clearFailedEvents,
  } = useSyncQueue({
    telegramBotToken,
    telegramChatId,
  });

  const totalEvents = syncStatus.pendingCount + syncStatus.failedCount;
  const hasIssues = syncStatus.failedCount > 0;
  const isFlushing = syncStatus.isFlushing;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Sync Manager
          <div className="ml-auto flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-yellow-500" />
            )}
            <span className="text-sm font-normal text-muted-foreground">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/40">
            <div className="flex items-center justify-center gap-1 text-sm font-medium text-blue-600">
              <Clock className="w-4 h-4" />
              Pending
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {syncStatus.pendingCount}
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-muted/40">
            <div className="flex items-center justify-center gap-1 text-sm font-medium text-red-600">
              <AlertTriangle className="w-4 h-4" />
              Failed
            </div>
            <div className="text-2xl font-bold text-red-600">
              {syncStatus.failedCount}
            </div>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-muted/40">
            <div className="flex items-center justify-center gap-1 text-sm font-medium text-green-600">
              <CheckCircle className="w-4 h-4" />
              Status
            </div>
            <div className="text-lg font-bold text-green-600">
              {isFlushing ? 'Flushing' : totalEvents === 0 ? 'Ready' : 'Queued'}
            </div>
          </div>
        </div>

        {/* Progress Bar for Active Operations */}
        {(isFlushing || syncStatus.isSyncing) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {isFlushing ? 'Flushing Events...' : 'Syncing Events...'}
              </span>
              <span className="text-muted-foreground">
                {syncStatus.syncProgress} / {syncStatus.totalToSync}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <motion.div
                className="bg-primary h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ 
                  width: `${(syncStatus.syncProgress / syncStatus.totalToSync) * 100}%` 
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Connection Status Message */}
        <div className={`p-4 rounded-lg border ${
          syncStatus.wasOffline && isOnline 
            ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200'
            : isOnline 
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {syncStatus.wasOffline && isOnline ? (
              <Upload className="w-4 h-4" />
            ) : isOnline ? (
              <Shield className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span className="font-medium">
              {syncStatus.wasOffline && isOnline 
                ? 'Connection Restored'
                : isOnline 
                  ? 'Connection Stable' 
                  : 'Connection Lost'
              }
            </span>
          </div>
          <p className="text-sm mt-1">
            {syncStatus.wasOffline && isOnline 
              ? `Syncing ${syncStatus.pendingCount} missed events from offline period...`
              : isOnline 
                ? syncStatus.pendingCount === 0 
                  ? 'All events synced successfully' 
                  : `${totalEvents} events ready for sync`
                : 'Events will be queued until connection is restored'
            }
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {hasIssues && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={retryFailedEvents}
                disabled={isFlushing || syncStatus.isSyncing}
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Failed
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={clearFailedEvents}
                disabled={isFlushing || syncStatus.isSyncing}
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Failed
              </Button>
            </div>
          )}
          
          {totalEvents > 0 && !hasIssues && (
            <Button
              variant="default"
              size="sm"
              onClick={flushQueue}
              disabled={isFlushing || syncStatus.isSyncing || !isOnline}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              Sync Now
            </Button>
          )}
        </div>

        {/* Last Sync Info */}
        {syncStatus.lastSyncTime && (
          <div className="text-center p-3 rounded-lg bg-muted/20">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last sync: {new Date(syncStatus.lastSyncTime).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SyncStatsProps {
  telegramBotToken: string;
  telegramChatId: string;
}

export function SyncStats({ telegramBotToken, telegramChatId }: SyncStatsProps) {
  const { isOnline } = useConnectivity();
  const { syncStatus } = useSyncQueue({
    telegramBotToken,
    telegramChatId,
  });

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Sync Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Connection Status</Label>
            <div className="flex items-center gap-2">
              {isOnline ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <WifiOff className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-sm">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium">Queue Status</Label>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm">
                {syncStatus.isFlushing ? 'Flushing' : 'Idle'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {syncStatus.pendingCount}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {syncStatus.failedCount}
            </div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
        </div>

        {syncStatus.lastSyncTime && (
          <div className="text-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Last sync: {new Date(syncStatus.lastSyncTime).toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}