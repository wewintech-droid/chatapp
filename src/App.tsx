import React, { useState, useEffect, useCallback } from 'react';
import LoginScreen from './components/LoginScreen';
import UsernameSetup from './components/UsernameSetup';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import AddContactModal from './components/AddContactModal';
import { useWebSocket } from './hooks/useWebSocket';
import type { CallOfferPayload, CallAnswerPayload, IceCandidatePayload, Contact, Message, Room } from './types';

type CallSignal =
  | ({ type: 'offer'; callType: 'voice' | 'video'; description: RTCSessionDescriptionInit } & Omit<CallOfferPayload, 'callType' | 'description'>)
  | ({ type: 'answer'; description: RTCSessionDescriptionInit } & Omit<CallAnswerPayload, 'description'>)
  | ({ type: 'ice'; candidate: RTCIceCandidateInit } & Omit<IceCandidatePayload, 'candidate'>)
  | { type: 'end'; from: string; to?: string; roomId?: string };

const DEFAULT_CONTACTS: Contact[] = [
  { 
    username: 'alex_tech', 
    status: 'online', 
    bio: 'Frontend Developer',
    lastSeen: new Date(Date.now() - 180000).toISOString()
  },
  { 
    username: 'pixel_queen', 
    status: 'online', 
    bio: 'Digital Artist',
    lastSeen: new Date().toISOString()
  },
  { 
    username: 'server_pro', 
    status: 'offline', 
    bio: 'Networking Guru',
    lastSeen: new Date(Date.now() - 7200000).toISOString()
  },
];

const App: React.FC = () => {
  // Auth States
  const [step, setStep] = useState<'login' | 'username' | 'app'>('login');
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // Data States
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeContact, setActiveContact] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [inputValue, setInputValue] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [searchUser, setSearchUser] = useState<string>('');
  const [savedChats, setSavedChats] = useState<Record<string, boolean>>({});
  const [privacyMode, setPrivacyMode] = useState<boolean>(false);
  const [callSignal, setCallSignal] = useState<CallSignal | null>(null);

  const handleIncomingMessage = useCallback((message: Message) => {
    const chatKey = message.roomId || message.from;
    setMessages(prev => {
      const existing = prev[chatKey] || [];
      if (existing.some(m => m.id === message.id)) return prev;
      return {
        ...prev,
        [chatKey]: [...existing, message]
      };
    });
  }, []);

  const handleDeletedMessage = useCallback((messageId: string, chatKey: string) => {
    setMessages(prev => {
      const current = prev[chatKey] || [];
      const filtered = current.filter((msg) => msg.id !== messageId);
      if (filtered.length === current.length) return prev;
      return { ...prev, [chatKey]: filtered };
    });
  }, []);

  const handleCallSignal = useCallback((signal: CallSignal) => {
    setCallSignal(signal);
  }, []);

  const handleDeliveryReceipt = useCallback((payload: { messageId: string; chatKey: string; roomId?: string }) => {
    setMessages(prev => {
      const chat = prev[payload.chatKey] || [];
      return {
        ...prev,
        [payload.chatKey]: chat.map((msg) =>
          msg.id === payload.messageId ? { ...msg, isDelivered: true } : msg
        ),
      };
    });
  }, []);

  const handleReadReceipt = useCallback((payload: { messageId: string; chatKey: string; from: string }) => {
    setMessages(prev => {
      const chat = prev[payload.chatKey] || [];
      return {
        ...prev,
        [payload.chatKey]: chat.map((msg) => {
          if (msg.id !== payload.messageId) return msg;
          const existing = msg.readBy || [];
          if (existing.includes(payload.from)) return msg;
          return { ...msg, readBy: [...existing, payload.from] };
        }),
      };
    });
  }, []);

  const handleSaveChat = useCallback((chatKey: string, save: boolean) => {
    setSavedChats(prev => ({ ...prev, [chatKey]: save }));
    setMessages(prev => {
      const current = prev[chatKey] || [];
      if (!current.length) return prev;
      return {
        ...prev,
        [chatKey]: current.map((msg) => ({
          ...msg,
          saved: save ? true : msg.saved,
          expiresAt: save ? undefined : msg.expiresAt,
        }))
      };
    });
  }, []);

  // WebSocket Hook
  const {
    connect,
    wsRef,
    onlineUsers,
    typingUsers,
    activeChatUsers,
    sendMessage: sendViaSocket,
    sendReadReceipt,
    sendPrivacyUpdate,
    sendCallOffer,
    sendCallAnswer,
    sendIceCandidate,
    sendCallEnd,
    sendTypingStatus,
    sendActiveChatStatus,
  } = useWebSocket(username, {
    onMessage: handleIncomingMessage,
    onMessageDeleted: handleDeletedMessage,
    onCallSignal: handleCallSignal,
    onPrivacyUpdate: (payload) => {
      console.log('Privacy update from server:', payload);
    },
    onMessageDelivered: handleDeliveryReceipt,
    onMessageRead: handleReadReceipt,
  });

  const togglePrivacyMode = useCallback((enabled: boolean) => {
    setPrivacyMode(enabled);
    sendPrivacyUpdate({ username, privacyMode: enabled });
  }, [sendPrivacyUpdate, username]);

  useEffect(() => {
    const chatKey = activeRoom?.id || activeContact;
    if (!chatKey) return;

    const timeout = window.setTimeout(() => {
      const chatMessages = messages[chatKey] || [];
      const unreadMessages = chatMessages.filter((msg) => msg.from !== username && !(msg.readBy || []).includes(username));
      if (!unreadMessages.length) return;

      unreadMessages.forEach((msg) => {
        sendReadReceipt({
          messageId: msg.id,
          chatKey,
          from: username,
          to: activeRoom ? undefined : msg.from,
          roomId: activeRoom?.id,
        });
      });

      setMessages((prev) => ({
        ...prev,
        [chatKey]: (prev[chatKey] || []).map((msg) =>
          msg.from !== username && !(msg.readBy || []).includes(username)
            ? { ...msg, readBy: [...(msg.readBy || []), username] }
            : msg
        ),
      }));
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeContact, activeRoom, messages, username, sendReadReceipt]);

  useEffect(() => {
    const cleanup = window.setInterval(() => {
      const now = Date.now();
      setMessages(prev => {
        const next: Record<string, Message[]> = {};
        let changed = false;

        for (const chatKey in prev) {
          const filtered = prev[chatKey].filter((msg) => {
            if (msg.saved) return true;
            return !msg.expiresAt || new Date(msg.expiresAt).getTime() > now;
          });
          if (filtered.length !== prev[chatKey].length) {
            changed = true;
          }
          if (filtered.length > 0) {
            next[chatKey] = filtered;
          }
        }

        return changed ? next : prev;
      });
    }, 60_000);

    return () => {
      window.clearInterval(cleanup);
    };
  }, []);

  // Connect WebSocket when app loads
  useEffect(() => {
    if (step === 'app' && username) {
      connect();
    }
  }, [step, username, connect]);

  // Update active chat status
  useEffect(() => {
    sendActiveChatStatus(!!(activeContact || activeRoom));
  }, [activeContact, activeRoom, sendActiveChatStatus]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const target = activeRoom?.id || activeContact;
    const roomId = activeRoom?.id;
    if (target) sendTypingStatus(target, true, roomId);
  };

  const sendMessage = () => {
    if (!inputValue.trim() || (!activeContact && !activeRoom) || !wsRef.current) return;

    const chatKey = activeRoom?.id || activeContact!;
    const isSaved = !!savedChats[chatKey];

    const newMessage: Message = {
      id: Math.random().toString(36).substring(2, 15),
      from: username,
      to: activeContact || undefined,
      roomId: activeRoom?.id,
      text: inputValue.trim(),
      timestamp: new Date().toISOString(),
      readBy: [],
      isDelivered: false,
      saved: isSaved,
      expiresAt: isSaved ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    // Optimistic UI Update
    setMessages(prev => ({
      ...prev,
      [chatKey]: [...(prev[chatKey] || []), newMessage]
    }));

    // Send via WebSocket
    sendViaSocket(newMessage);

    setInputValue('');
    sendTypingStatus(chatKey, false, activeRoom?.id);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setAuthError('Please enter a valid email.');
      return;
    }
    setStep('username');
    setAuthError('');
  };

  const handleUsernameSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length < 3) {
      setAuthError('Username must be at least 3 characters.');
      return;
    }
    setStep('app');
    setAuthError('');
  };

  const createGroupRoom = () => {
    const groupMembers = [username, ...contacts.filter((contact) => onlineUsers.has(contact.username)).map((contact) => contact.username)];
    const uniqueMembers = Array.from(new Set(groupMembers));
    const newRoom: Room = {
      id: 'room_' + Math.random().toString(36).substring(2, 12),
      name: `Group Chat ${Math.floor(Math.random() * 999)}`,
      participants: uniqueMembers,
      isGroup: true,
    };
    setRooms(prev => [...prev, newRoom]);
    setActiveRoom(newRoom);
    setActiveContact(null);
  };

  // Render Auth Screens
  if (step === 'login') {
    return <LoginScreen email={email} setEmail={setEmail} authError={authError} onSubmit={handleLogin} />;
  }

  if (step === 'username') {
    return <UsernameSetup username={username} setUsername={setUsername} authError={authError} onSubmit={handleUsernameSetup} />;
  }

  // Main Application
  return (
    <div className="flex h-screen bg-[#1E1F22] text-[#DBDEE1] overflow-hidden">
      <Sidebar
        contacts={contacts}
        rooms={rooms}
        activeContact={activeContact}
        activeRoom={activeRoom}
        setActiveContact={setActiveContact}
        setActiveRoom={setActiveRoom}
        username={username}
        onCreateRoom={createGroupRoom}
        onAddContact={() => setIsAdding(true)}
        onAddUser={(user) => {
          if (!contacts.some(contact => contact.username === user)) {
            setContacts(prev => [...prev, { username: user, status: 'online', bio: 'New connection', lastSeen: new Date().toISOString() }]);
          }
          setActiveContact(user);
          setActiveRoom(null);
        }}
        onLogout={() => setStep('login')}
        onlineUsers={onlineUsers}
        typingUsers={typingUsers}
        activeChatUsers={activeChatUsers}
      />

      <ChatArea
        activeContact={activeContact}
        activeRoom={activeRoom}
        messages={messages}
        inputValue={inputValue}
        sendMessage={sendMessage}
        username={username}
        typingUsers={typingUsers}
        handleInputChange={handleInputChange}
        onlineUsers={onlineUsers}
        contacts={contacts}
        privacyMode={privacyMode}
        savedChats={savedChats}
        onSaveChat={handleSaveChat}
        callSignal={callSignal}
        sendCallOffer={sendCallOffer}
        sendCallAnswer={sendCallAnswer}
        sendIceCandidate={sendIceCandidate}
        sendCallEnd={sendCallEnd}
        onPrivacyChange={togglePrivacyMode}
      />

      {isAdding && (
        <AddContactModal
          searchUser={searchUser}
          setSearchUser={setSearchUser}
          onClose={() => setIsAdding(false)}
          onAdd={() => {
            if (searchUser.trim()) {
              const newContact: Contact = {
                username: searchUser.trim(),
                status: 'online',
                bio: 'New Connection',
                lastSeen: new Date().toISOString(),
              };
              setContacts(prev => [...prev, newContact]);
              setActiveContact(searchUser.trim());
              setIsAdding(false);
              setSearchUser('');
            }
          }}
        />
      )}
    </div>
  );
};

export default App;