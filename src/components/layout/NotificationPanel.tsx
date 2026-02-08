import { useEffect, useRef } from 'react';
import { Bell, Truck, Building2, AlertTriangle, Package, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { adminLogger } from '../../utils/logger';
import type { AdminNotification } from '../../types';
import { markNotificationRead, markAllNotificationsRead } from '../../services/adminService';

interface NotificationPanelProps {
  notifications: AdminNotification[];
  onClose: () => void;
  onRefresh: () => void;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; route: string }> = {
  new_driver: { icon: Truck, color: 'text-green-600', bg: 'bg-green-100', route: '/drivers' },
  new_company: { icon: Building2, color: 'text-purple-600', bg: 'bg-purple-100', route: '/companies' },
  incident: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', route: '/incidents' },
  delivery_failed: { icon: Package, color: 'text-yellow-600', bg: 'bg-yellow-100', route: '/deliveries' },
};

export default function NotificationPanel({ notifications, onClose, onRefresh }: NotificationPanelProps) {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleClick = async (notification: AdminNotification) => {
    try {
      if (!notification.is_read) {
        await markNotificationRead(notification.id);
        onRefresh();
      }
      const config = TYPE_CONFIG[notification.type];
      if (config) {
        navigate(config.route);
      }
      onClose();
    } catch (error) {
      adminLogger.error('Error handling notification click', { error });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      onRefresh();
    } catch (error) {
      adminLogger.error('Error marking all notifications read', { error });
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tout marquer lu
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Aucune notification</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const config = TYPE_CONFIG[notification.type] || TYPE_CONFIG.incident;
            const Icon = config.icon;

            return (
              <button
                key={notification.id}
                onClick={() => handleClick(notification)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700 ${
                  !notification.is_read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className={`w-8 h-8 ${config.bg} rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!notification.is_read ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{notification.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
