import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  AlertTriangle, 
  XCircle, 
  CheckCircle, 
  Clock, 
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  Unlock
} from "lucide-react";
import { useEnhancedAuth } from "@/hooks/use-enhanced-auth";

export function SecurityStatus() {
  const { 
    isBlocked, 
    blockTimeRemaining, 
    loginAttempts, 
    lastLoginAttempt,
    securityAlerts,
    clearSecurityAlerts 
  } = useEnhancedAuth();

  const [showAlerts, setShowAlerts] = React.useState(false);

  // Format time remaining
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get alert icon based on type
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'failed_login':
        return <XCircle className="h-4 w-4" />;
      case 'suspicious_activity':
        return <AlertTriangle className="h-4 w-4" />;
      case 'ip_blocked':
        return <Lock className="h-4 w-4" />;
      case 'rate_limit':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  // Get alert color based on severity
  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'default';
      default:
        return 'default';
    }
  };

  // Get severity badge variant
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (!isBlocked && loginAttempts === 0 && securityAlerts.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-green-600" />
            <CardTitle className="text-lg text-green-800">Безопасность в норме</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-green-700">
            Все системы безопасности работают нормально. Ваш аккаунт защищен.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Block Status */}
      {isBlocked && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <Lock className="h-5 w-5 text-red-600" />
              <CardTitle className="text-lg text-red-800">Доступ заблокирован</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-red-700 mb-3">
              Слишком много неудачных попыток входа. Попробуйте снова через {formatTime(blockTimeRemaining)}.
            </CardDescription>
            <div className="flex items-center space-x-2 text-sm text-red-600">
              <Clock className="h-4 w-4" />
              <span>Осталось времени: {formatTime(blockTimeRemaining)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Login Attempts Warning */}
      {loginAttempts > 0 && !isBlocked && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg text-yellow-800">Неудачные попытки входа</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-yellow-700 mb-3">
              Зафиксировано {loginAttempts} неудачных попыток входа.
              {loginAttempts >= 3 && " Будьте осторожны - при достижении 5 попыток доступ будет заблокирован."}
            </CardDescription>
            {lastLoginAttempt && (
              <div className="flex items-center space-x-2 text-sm text-yellow-600">
                <Clock className="h-4 w-4" />
                <span>Последняя попытка: {lastLoginAttempt.toLocaleTimeString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Alerts */}
      {securityAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">События безопасности</CardTitle>
                <Badge variant="secondary">{securityAlerts.length}</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAlerts(!showAlerts)}
                >
                  {showAlerts ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSecurityAlerts}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {showAlerts && (
            <CardContent>
              <div className="space-y-3">
                {securityAlerts.map((alert) => (
                  <Alert key={alert.id} variant={getAlertColor(alert.severity)}>
                    <div className="flex items-start space-x-2">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={getSeverityBadge(alert.severity)} size="sm">
                            {alert.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {alert.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <AlertDescription>{alert.message}</AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Security Tips */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-blue-800">Советы по безопасности</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-blue-700">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Используйте сложные пароли с буквами, цифрами и символами</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Не передавайте свои учетные данные третьим лицам</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Выходите из системы на общественных компьютерах</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Регулярно обновляйте пароли</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


