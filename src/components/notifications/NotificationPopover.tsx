import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const typeIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
};

const typeColors = {
  info: 'text-info',
  warning: 'text-warning',
  success: 'text-success',
  error: 'text-destructive',
};

type Notification = {
  id: string;
  user_id: string;
  tenant_id: string | null;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  read: boolean;
  link: string | null;
  created_at: string;
};

export function NotificationPopover() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
  };

  const handleMarkAsRead = async () => {
    if (selectedNotification && !selectedNotification.read) {
      await markAsRead(selectedNotification.id);
      setSelectedNotification(prev => prev ? { ...prev, read: true } : null);
    }
  };

  const handleGoToLink = () => {
    if (selectedNotification?.link) {
      setSelectedNotification(null);
      navigate(selectedNotification.link);
    }
  };

  const SelectedIcon = selectedNotification ? (typeIcons[selectedNotification.type] || Info) : Info;
  const selectedColor = selectedNotification ? (typeColors[selectedNotification.type] || 'text-muted-foreground') : '';

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h4 className="font-semibold">Notificaciones</h4>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllAsRead}>
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>

          <ScrollArea className="h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-20">
                <span className="text-sm text-muted-foreground">Cargando...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-50" />
                <span className="text-sm">No hay notificaciones</span>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => {
                  const Icon = typeIcons[notification.type] || Info;
                  const colorClass = typeColors[notification.type] || 'text-muted-foreground';

                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'relative flex gap-3 p-4 hover:bg-muted/50 cursor-pointer transition-colors group',
                        !notification.read && 'bg-primary/5'
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className={cn('flex-shrink-0 mt-0.5', colorClass)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-sm', !notification.read && 'font-medium')}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="flex-shrink-0 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                            locale: es,
                          })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100 absolute top-2 right-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {notifications.length > 0 && (
            <>
              <Separator />
              <div className="p-2">
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/notifications')}>
                  Ver todas las notificaciones
                </Button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn('flex-shrink-0', selectedColor)}>
                <SelectedIcon className="h-6 w-6" />
              </div>
              <DialogTitle className="text-base">{selectedNotification?.title}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {selectedNotification?.message}
            </p>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedNotification && formatDistanceToNow(new Date(selectedNotification.created_at), {
                  addSuffix: true,
                  locale: es,
                })}
              </p>
              <Badge variant={selectedNotification?.read ? 'secondary' : 'default'}>
                {selectedNotification?.read ? 'Leída' : 'No leída'}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            {selectedNotification && !selectedNotification.read && (
              <Button variant="outline" onClick={handleMarkAsRead}>
                <Check className="h-4 w-4 mr-1" />
                Marcar como leída
              </Button>
            )}
            {selectedNotification?.link && (
              <Button onClick={handleGoToLink}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Ir al detalle
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
