import { useState, useRef, useCallback, useEffect } from 'react';
import type { WebSocketMessage, Message, CallOfferPayload, CallAnswerPayload, IceCandidatePayload, MessageSavePayload, PrivacyPayload, DeliveryReceiptPayload, ReadReceiptPayload } from '../types';

type CallSignal =
  | ({ type: 'offer'; callType: 'voice' | 'video'; description: RTCSessionDescriptionInit } & Omit<CallOfferPayload, 'callType' | 'description'>)
  | ({ type: 'answer'; description: RTCSessionDescriptionInit } & Omit<CallAnswerPayload, 'description'>)
  | ({ type: 'ice'; candidate: RTCIceCandidateInit } & Omit<IceCandidatePayload, 'candidate'>)
  | { type: 'end'; from: string; to?: string; roomId?: string };

type WebSocketHandlers = {
  onMessage?: (message: Message) => void;
  onMessageDeleted?: (messageId: string, chatKey: string) => void;
  onCallSignal?: (signal: CallSignal) => void;
  onPrivacyUpdate?: (payload: PrivacyPayload) => void;
  onMessageDelivered?: (payload: DeliveryReceiptPayload) => void;
  onMessageRead?: (payload: ReadReceiptPayload) => void;
};

const getWebSocketUrls = () => {
  const envUrl = import.meta.env.VITE_WS_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const hostname = window.location.hostname || '127.0.0.1';
  const primaryUrl = typeof envUrl === 'string' && envUrl.trim()
    ? envUrl
    : `${protocol}://${hostname}:8000/ws`;

  const fallbackUrl = typeof import.meta.env.VITE_WS_FALLBACK_URL === 'string' && import.meta.env.VITE_WS_FALLBACK_URL.trim()
    ? import.meta.env.VITE_WS_FALLBACK_URL
    : 'wss://free.blr2.piesocket.com/v3/1?api_key=YnqGBxsb4JcET5RDMuKwGbPwFHbxCjUBRRoObljf&notify_self=1';

  return [primaryUrl, fallbackUrl];
};

export const useWebSocket = (currentUsername: string, handlers?: WebSocketHandlers) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);

  // Real-time Presence & Activity
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [activeChatUsers, setActiveChatUsers] = useState<Record<string, boolean>>({});

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<Record<string, number>>({});
  const handlersRef = useRef<WebSocketHandlers | undefined>(handlers);
  const reconnectAttemptsRef = useRef<number>(0);
  const connectInProgressRef = useRef<boolean>(false);
  const isManualDisconnectRef = useRef<boolean>(false);
  const urlIndexRef = useRef<number>(0);
  const connectRef = useRef<() => void>(() => {});

  const MAX_RECONNECT_ATTEMPTS = 6;
  const HEARTBEAT_INTERVAL = 25000; // 25 seconds

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const clearReconnectTimer = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connect = useCallback(() => {
    if (!currentUsername) {
      console.warn('WebSocket connect aborted: username is not set');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN || connectInProgressRef.current) return;

    clearReconnectTimer();
    connectInProgressRef.current = true;
    isManualDisconnectRef.current = false;
    setConnectionStatus('connecting');

    const urls = getWebSocketUrls();
    const wsUrl = urls[urlIndexRef.current] || urls[0];
    console.debug('Connecting WebSocket to', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      connectInProgressRef.current = false;
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      setConnectionStatus('connected');
      clearReconnectTimer();

      // Authenticate user
      ws.send(JSON.stringify({
        type: 'auth',
        payload: { username: currentUsername }
      }));

      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Start heartbeat
      heartbeatIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const rawData = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
        const data: WebSocketMessage = JSON.parse(rawData);

        switch (data.type) {
          case 'pong':
            break;

          // Presence
          case 'user_online': {
            const payload = data.payload as { username: string };
            setOnlineUsers(prev => new Set(prev).add(payload.username));
            break;
          }

          case 'user_offline': {
            const payload = data.payload as { username: string };
            setOnlineUsers(prev => {
              const updated = new Set(prev);
              updated.delete(payload.username);
              return updated;
            });
            break;
          }

          case 'online_users': {
            const payload = data.payload as string[];
            setOnlineUsers(new Set(payload));
            break;
          }

          // Typing Indicators
          case 'typing_start': {
            const payload = data.payload as { from: string; to?: string; roomId?: string };
            setTypingUsers(prev => ({ ...prev, [payload.from]: true }));
            if (typingTimeoutRef.current[payload.from]) {
              clearTimeout(typingTimeoutRef.current[payload.from]);
            }
            typingTimeoutRef.current[payload.from] = window.setTimeout(() => {
              setTypingUsers(prev => ({ ...prev, [payload.from]: false }));
            }, 2800);
            break;
          }

          case 'typing_stop': {
            const payload = data.payload as { from: string };
            setTypingUsers(prev => ({ ...prev, [payload.from]: false }));
            break;
          }

          // Active Chat Status
          case 'chat_active': {
            const payload = data.payload as { username: string; isActive?: boolean };
            setActiveChatUsers(prev => ({ ...prev, [payload.username]: true }));
            break;
          }

          case 'chat_inactive': {
            const payload = data.payload as { username: string; isActive?: boolean };
            setActiveChatUsers(prev => ({ ...prev, [payload.username]: false }));
            break;
          }

          // === MESSAGE HANDLING (DM + Room) ===
          case 'message':
          case 'room_message': {
            const message = data.payload as Message;
            console.log(`📨 New ${message.roomId ? 'Room' : 'DM'} message:`, message);
            if (message.from !== currentUsername) {
              handlersRef.current?.onMessage?.(message);
            }
            break;
          }

          case 'message_deleted': {
            const payload = data.payload as { messageId: string; chatKey: string };
            handlersRef.current?.onMessageDeleted?.(payload.messageId, payload.chatKey);
            break;
          }

          case 'message_saved': {
            const payload = data.payload as MessageSavePayload;
            console.log('💾 Message saved:', payload);
            break;
          }

          case 'privacy_update': {
            const payload = data.payload as PrivacyPayload;
            handlersRef.current?.onPrivacyUpdate?.(payload);
            break;
          }

          case 'call_offer': {
            const payload = data.payload as CallOfferPayload;
            handlersRef.current?.onCallSignal?.({ type: 'offer', ...payload });
            break;
          }

          case 'call_answer': {
            const payload = data.payload as CallAnswerPayload;
            handlersRef.current?.onCallSignal?.({ type: 'answer', ...payload });
            break;
          }

          case 'ice_candidate': {
            const payload = data.payload as IceCandidatePayload;
            handlersRef.current?.onCallSignal?.({ type: 'ice', ...payload });
            break;
          }

          case 'call_end': {
            const payload = data.payload as { from: string; to?: string; roomId?: string };
            handlersRef.current?.onCallSignal?.({ type: 'end', ...payload });
            break;
          }

          case 'message_delivered': {
            const payload = data.payload as DeliveryReceiptPayload;
            handlersRef.current?.onMessageDelivered?.(payload);
            break;
          }

          case 'message_read': {
            const payload = data.payload as ReadReceiptPayload;
            handlersRef.current?.onMessageRead?.(payload);
            break;
          }

          default:
            console.log('Unknown WebSocket message type:', data.type, data.payload);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = (event) => {
      connectInProgressRef.current = false;
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.log(`WebSocket closed. Code: ${event.code}`);

      if (!isManualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const urls = getWebSocketUrls();
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
        reconnectAttemptsRef.current += 1;
        setReconnectAttempts(reconnectAttemptsRef.current);

        if (urlIndexRef.current === 0 && urls.length > 1) {
          urlIndexRef.current = 1;
          console.warn('Primary socket failed; switching to fallback WebSocket URL.');
        }

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
      const urls = getWebSocketUrls();
      if (!isManualDisconnectRef.current && urlIndexRef.current === 0 && urls.length > 1) {
        urlIndexRef.current = 1;
        console.warn('WebSocket error on primary URL; switching to fallback WebSocket URL.');
      }
    };
  }, [currentUsername]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimer();

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    Object.values(typingTimeoutRef.current).forEach(clearTimeout);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const manualReconnect = useCallback(() => {
    isManualDisconnectRef.current = true;
    clearReconnectTimer();
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    disconnect();
    setTimeout(() => {
      connect();
    }, 150);
  }, [disconnect, connect]);

  // Send Message (Supports both DM and Room)
  const sendMessage = useCallback((message: Message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageType = message.roomId ? 'room_message' : 'message_sent';
      wsRef.current.send(JSON.stringify({
        type: messageType,
        payload: message
      }));
    }
  }, []);

  const saveMessage = useCallback((payload: MessageSavePayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message_saved',
        payload
      }));
    }
  }, []);

  const sendPrivacyUpdate = useCallback((payload: PrivacyPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'privacy_update',
        payload
      }));
    }
  }, []);

  const sendCallOffer = useCallback((payload: CallOfferPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'call_offer', payload }));
    }
  }, []);

  const sendCallAnswer = useCallback((payload: CallAnswerPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'call_answer', payload }));
    }
  }, []);

  const sendIceCandidate = useCallback((payload: IceCandidatePayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ice_candidate', payload }));
    }
  }, []);

  const sendCallEnd = useCallback((payload: { from: string; to?: string; roomId?: string }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'call_end', payload }));
    }
  }, []);

  const sendReadReceipt = useCallback((payload: ReadReceiptPayload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message_read', payload }));
    }
  }, []);

  // Send Typing Status
  const sendTypingStatus = useCallback((target: string, isTyping: boolean, roomId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: isTyping ? 'typing_start' : 'typing_stop',
        payload: {
          from: currentUsername,
          to: target,
          roomId,
        }
      }));
    }
  }, [currentUsername]);

  // Send Active/Inactive Chat Status
  const sendActiveChatStatus = useCallback((isActive: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: isActive ? 'chat_active' : 'chat_inactive',
        payload: { username: currentUsername }
      }));
    }
  }, [currentUsername]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    isConnected,
    connectionStatus,
    connect,
    manualReconnect,
    wsRef,
    onlineUsers,
    typingUsers,
    activeChatUsers,
    sendMessage,
    saveMessage,
    sendPrivacyUpdate,
    sendCallOffer,
    sendCallAnswer,
    sendIceCandidate,
    sendCallEnd,
    sendReadReceipt,
    sendTypingStatus,
    sendActiveChatStatus,
    reconnectAttempts,
  };
};