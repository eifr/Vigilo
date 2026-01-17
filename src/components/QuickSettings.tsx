import { motion } from 'motion/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Eye
} from 'lucide-react';

interface QuickSettingsProps {
  title: string;
  description?: string;
  children?: any;
}

export function QuickSettings({ title, description, children }: QuickSettingsProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          {title}
        </CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'warning' | 'success';
  label: string;
  value?: string | number;
  icon?: any;
}

export function StatusIndicator({ status, label, value, icon: Icon }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'online': return 'text-green-600';
      case 'offline': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBg = () => {
    switch (status) {
      case 'online': return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
      case 'offline': return 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800';
      case 'warning': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800';
      case 'success': return 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800';
      default: return 'bg-muted/40 border-border';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getStatusBg()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-4 h-4 ${getStatusColor()}`} />}
          <span className="text-sm font-medium">{label}</span>
        </div>
        {value && (
          <span className={`text-lg font-bold ${getStatusColor()}`}>
            {value}
          </span>
        )}
      </div>
    </div>
  );
}

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'destructive';
  icon?: any;
  disabled?: boolean;
  loading?: boolean;
}

export function ActionButton({ onClick, children, variant = 'default', icon: Icon, disabled = false, loading = false }: ActionButtonProps) {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full"
    >
      {loading ? (
        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 mr-2" />
      ) : null}
      {children}
    </Button>
  );
}

interface MonitoringStatsProps {
  isActive: boolean;
  eventsToday?: number;
  lastEvent?: Date;
  camerasActive?: number;
}

export function MonitoringStats({ isActive, eventsToday = 0, lastEvent, camerasActive = 0 }: MonitoringStatsProps) {
  const getStatusIcon = () => {
    if (isActive) {
      return <Zap className="w-4 h-4 text-green-500" />;
    } else {
      return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    if (isActive) return 'Active';
    return 'Idle';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Monitoring Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted/40 rounded-lg">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">System Status</span>
          </div>
          <span className={`font-bold ${isActive ? 'text-green-600' : 'text-muted-foreground'}`}>
            {getStatusText()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatusIndicator
            status={eventsToday > 0 ? 'success' : 'online'}
            label="Events Today"
            value={eventsToday}
            icon={AlertTriangle}
          />
          
          <StatusIndicator
            status={camerasActive > 0 ? 'online' : 'offline'}
            label="Active Cameras"
            value={camerasActive}
            icon={Eye}
          />
        </div>

        {lastEvent && (
          <div className="text-center p-3 rounded-lg bg-muted/20">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last Event: {lastEvent.toLocaleTimeString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickConfigProps {
  debounceTime: number;
  setDebounceTime: (value: number) => void;
  sensitivityLevel: 'low' | 'medium' | 'high';
  setSensitivityLevel: (level: 'low' | 'medium' | 'high') => void;
}

export function QuickConfig({ debounceTime, setDebounceTime, sensitivityLevel, setSensitivityLevel }: QuickConfigProps) {
  const sensitivityOptions = [
    { value: 'low', label: 'Low', description: 'Less sensitive' },
    { value: 'medium', label: 'Medium', description: 'Balanced' },
    { value: 'high', label: 'High', description: 'Very sensitive' },
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Quick Config
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="debounce-time" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Debounce Time (ms)
          </Label>
          <Input
            id="debounce-time"
            type="number"
            value={debounceTime}
            onInput={(e) =>
              setDebounceTime(parseInt((e.target as HTMLInputElement).value, 10))
            }
            min="1000"
            max="30000"
            step="500"
          />
          <p className="text-xs text-muted-foreground">
            Minimum time between motion alerts
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Sensitivity Level
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {sensitivityOptions.map((option) => (
              <Button
                key={option.value}
                variant={sensitivityLevel === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSensitivityLevel(option.value as 'low' | 'medium' | 'high')}
                className="flex-col h-auto py-2"
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-xs opacity-75">{option.description}</span>
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}