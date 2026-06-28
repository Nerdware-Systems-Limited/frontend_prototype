import { defineStore } from 'pinia'
import { useNotificationSocket } from '~/composables/useNotificationSocket'

// Shared Pinia store
export const useNotificationStore = defineStore('notifications', () => {
  const {
    notifications,
    unreadCount,
    isConnected,
    error,
    connect,
    disconnect,
    markRead,
  } = useNotificationSocket()

  return { notifications, unreadCount, isConnected, error, connect, disconnect, markRead }
})