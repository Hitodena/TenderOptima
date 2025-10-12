import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
  userId?: number;
  onNewEmail?: (data: any) => void;
}

export const useSocket = ({ userId, onNewEmail }: UseSocketOptions) => {
  const socketRef = useRef<Socket | null>(null);
  const onNewEmailRef = useRef(onNewEmail);
  
  // Update ref when callback changes
  useEffect(() => {
    onNewEmailRef.current = onNewEmail;
  }, [onNewEmail]);

  useEffect(() => {
    if (!userId) {
      console.log('🔌 Socket.IO: No userId provided, skipping connection');
      return;
    }

    console.log('🔌 Socket.IO: Attempting to connect for userId:', userId);

    // Подключаемся к Socket.IO серверу
    socketRef.current = io('http://localhost:5000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('🔌 Socket.IO: Connected to server with ID:', socket.id);
      
      // Аутентифицируемся с userId
      console.log('🔐 Socket.IO: Authenticating with userId:', userId);
      socket.emit('authenticate', { userId });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO: Connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO: Disconnected from server. Reason:', reason);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.IO: Reconnected after', attemptNumber, 'attempts');
      // Повторно аутентифицируемся после переподключения
      socket.emit('authenticate', { userId });
    });

    // Обрабатываем новые email
    socket.on('newEmail', (data) => {
      console.log('📧 Socket.IO: Received new email notification:', data);
      if (onNewEmailRef.current) {
        onNewEmailRef.current(data);
      }
    });

    return () => {
      console.log('🔌 Socket.IO: Cleaning up connection');
      if (socket) {
        socket.disconnect();
      }
    };
  }, [userId]);

  return socketRef.current;
};
