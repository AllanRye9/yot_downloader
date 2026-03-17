/**
 * Socket.IO client wrapper — singleton instance.
 * Import `socket` anywhere in the app to use real-time events.
 */
import { io } from 'socket.io-client'

const socket = io('/', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
})

export default socket
