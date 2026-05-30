// src/types.ts
export interface Message {
  id: string;
  from: string;
  to?: string;
  roomId?: string;
  text: string;
  timestamp: string;
  readBy?: string[];
  isDelivered?: boolean;
  expiresAt?: string;
  saved?: boolean;
  privacy?: 'standard' | 'private';
}

export interface Contact {
  username: string;
  status: 'online' | 'offline';
  bio?: string;
  lastSeen?: string;
  privacyMode?: boolean;
}

export interface Room {
  id: string;
  name: string;
  participants: string[];
  isGroup: boolean;
}

export interface CallOfferPayload {
  from: string;
  to?: string;
  roomId?: string;
  callType: 'voice' | 'video';
  description: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  from: string;
  to?: string;
  roomId?: string;
  description: RTCSessionDescriptionInit;
}

export interface IceCandidatePayload {
  from: string;
  to?: string;
  roomId?: string;
  candidate: RTCIceCandidateInit;
}

export interface PrivacyPayload {
  username: string;
  privacyMode: boolean;
}

export interface MessageSavePayload {
  messageId: string;
  chatKey: string;
  saved: boolean;
}

export interface DeliveryReceiptPayload {
  messageId: string;
  chatKey: string;
  to?: string;
  roomId?: string;
  timestamp?: string;
}

export interface ReadReceiptPayload {
  messageId: string;
  chatKey: string;
  from: string;
  to?: string;
  roomId?: string;
  timestamp?: string;
}

// Better typed WebSocket Message
export interface WebSocketMessage {
  type: 
    | 'auth'
    | 'ping'
    | 'pong'
    | 'message'
    | 'message_sent'
    | 'room_message'
    | 'user_online'
    | 'user_offline'
    | 'typing_start'
    | 'typing_stop'
    | 'chat_active'
    | 'chat_inactive'
    | 'message_read'
    | 'message_delivered'
    | 'message_deleted'
    | 'message_saved'
    | 'privacy_update'
    | 'online_users'
    | 'call_offer'
    | 'call_answer'
    | 'ice_candidate'
    | 'call_end';
  payload: 
    | Message 
    | { username: string }
    | { from: string; to?: string; roomId?: string }
    | { username: string; isActive?: boolean }
    | CallOfferPayload
    | CallAnswerPayload
    | IceCandidatePayload
    | PrivacyPayload
    | MessageSavePayload
    | DeliveryReceiptPayload
    | ReadReceiptPayload
    | { messageId: string; chatKey: string }
    | string[] 
    | unknown;
}

export type ChatKey = string; // username or roomId