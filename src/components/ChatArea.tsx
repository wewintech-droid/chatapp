import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Hash, Send, Check, CheckCheck, PhoneCall, Video, Bookmark, Palette } from 'lucide-react';
import type { Message, Room, Contact, CallOfferPayload, CallAnswerPayload, IceCandidatePayload } from '../types';

interface ChatAreaProps {
  activeContact: string | null;
  activeRoom: Room | null;
  messages: Record<string, Message[]>;
  inputValue: string;
  sendMessage: () => void;
  username: string;
  typingUsers: Record<string, boolean>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onlineUsers: Set<string>;
  contacts: Contact[];
  privacyMode: boolean;
  savedChats: Record<string, boolean>;
  onSaveChat: (chatKey: string, save: boolean) => void;
  onPrivacyChange: (enabled: boolean) => void;
  callSignal: CallSignal | null;
  sendCallOffer: (payload: CallOfferPayload) => void;
  sendCallAnswer: (payload: CallAnswerPayload) => void;
  sendIceCandidate: (payload: IceCandidatePayload) => void;
  sendCallEnd: (payload: { from: string; to?: string; roomId?: string }) => void;
  onUpdateRoomName: (roomId: string, newName: string) => void;
  chatTheme: 'midnight' | 'ocean' | 'forest' | 'slate';
  setChatTheme: (theme: 'midnight' | 'ocean' | 'forest' | 'slate') => void;
}

type CallSignal =
  | ({ type: 'offer'; callType: 'voice' | 'video'; description: RTCSessionDescriptionInit } & Omit<CallOfferPayload, 'callType' | 'description'>)
  | ({ type: 'answer'; description: RTCSessionDescriptionInit } & Omit<CallAnswerPayload, 'description'>)
  | ({ type: 'ice'; candidate: RTCIceCandidateInit } & Omit<IceCandidatePayload, 'candidate'>)
  | { type: 'end'; from: string; to?: string; roomId?: string };

const ChatArea: React.FC<ChatAreaProps> = ({
  activeContact,
  activeRoom,
  messages,
  inputValue,
  sendMessage,
  username,
  typingUsers,
  handleInputChange,
  onlineUsers,
  contacts,
  privacyMode,
  savedChats,
  onSaveChat,
  onPrivacyChange,
  callSignal,
  sendCallOffer,
  sendCallAnswer,
  sendIceCandidate,
  sendCallEnd,
  onUpdateRoomName,
  chatTheme,
  setChatTheme,
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'incoming' | 'connecting' | 'connected'>('idle');
  const [callMode, setCallMode] = useState<'voice' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<Extract<CallSignal, { type: 'offer' }> | null>(null);
  const roomNameInputRef = useRef<HTMLInputElement | null>(null);

  const cleanupCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setRemoteStream(null);
    setCallMode(null);
    setCallStatus('idle');
    setIncomingCall(null);
  }, [localStream]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeContact, activeRoom]);

  const getChatKey = () => activeRoom?.id || activeContact || '';

  const preparePeerConnection = useCallback(async (type: 'voice' | 'video') => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
    });

    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      sendIceCandidate({
        from: username,
        to: activeContact || undefined,
        roomId: activeRoom?.id,
        candidate: event.candidate,
      });
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setCallStatus('connected');
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        cleanupCall();
      }
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    setLocalStream(stream);
    return pc;
  }, [activeContact, activeRoom, cleanupCall, sendIceCandidate, username]);

  const startCall = async (type: 'voice' | 'video') => {
    if (!activeContact && !activeRoom) return;

    setCallMode(type);
    setCallStatus('connecting');

    try {
      const pc = await preparePeerConnection(type);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendCallOffer({
        from: username,
        to: activeContact || undefined,
        roomId: activeRoom?.id,
        callType: type,
        description: offer,
      });
    } catch (error) {
      console.error('Failed to start call:', error);
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    setCallStatus('connecting');
    try {
      const pc = await preparePeerConnection(incomingCall.callType);
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.description));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendCallAnswer({
        from: username,
        to: incomingCall.from,
        roomId: incomingCall.roomId,
        description: answer,
      });
      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to accept call:', error);
      cleanupCall();
    }
  };

  const declineCall = () => {
    if (incomingCall) {
      sendCallEnd({
        from: username,
        to: incomingCall.from,
        roomId: incomingCall.roomId,
      });
    }
    setIncomingCall(null);
    setCallStatus('idle');
  };

  const hangUp = () => {
    sendCallEnd({
      from: username,
      to: activeContact || undefined,
      roomId: activeRoom?.id,
    });
    cleanupCall();
  };

  useEffect(() => {
    if (!callSignal) return;

    if (callSignal.type === 'offer' && callSignal.from !== username) {
      queueMicrotask(() => {
        setIncomingCall(callSignal);
        setCallMode(callSignal.callType);
        setCallStatus('incoming');
      });
    }

    if (callSignal.type === 'answer' && callSignal.from !== username) {
      const pc = pcRef.current;
      if (pc) {
        pc.setRemoteDescription(new RTCSessionDescription(callSignal.description));
      }
    }

    if (callSignal.type === 'ice' && callSignal.from !== username) {
      const pc = pcRef.current;
      if (pc && callSignal.candidate) {
        pc.addIceCandidate(callSignal.candidate).catch((error) => console.error(error));
      }
    }

    if (callSignal.type === 'end' && callSignal.from !== username) {
      queueMicrotask(cleanupCall);
    }
  }, [callSignal, cleanupCall, username]);

  const activeRoomTypingUsers = activeRoom
    ? activeRoom.participants.filter((participant) => participant !== username && typingUsers[participant])
    : [];

  const currentMessages = getChatKey() ? messages[getChatKey()] || [] : [];
  const unreadCount = currentMessages.filter((msg) => msg.from !== username && !(msg.readBy || []).includes(username)).length;

  const isGroupChat = !!activeRoom;

  const themeStyles: Record<string, string> = {
    midnight: 'bg-[#313338]',
    ocean: 'bg-[#142B3D]',
    forest: 'bg-[#122818]',
    slate: 'bg-[#252D34]',
  };

  // Get last seen for DMs
  const getLastSeen = (user: string) => {
    const contact = contacts.find(c => c.username === user);
    if (!contact?.lastSeen) return 'Never';
    return new Date(contact.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex-1 flex flex-col relative ${themeStyles[chatTheme]}`}>
      {/* Header */}
      <div className="h-14 border-b border-black/20 flex items-center px-5 justify-between bg-[#313338]">
        <div className="flex items-center gap-3">
          <Hash className="text-[#80848E]" size={22} />
          <div>
            <span className="font-bold text-white">
              {isGroupChat ? activeRoom.name : activeContact ? `@${activeContact}` : 'Select a Chat'}
            </span>
            {isGroupChat && (
              <p className="text-xs text-[#949BA4]">{activeRoom.participants.length} members</p>
            )}
          </div>
        </div>

        {activeContact && !isGroupChat && (
          <div className="text-xs text-[#949BA4]">
            {privacyMode
              ? 'Last seen hidden'
              : onlineUsers.has(activeContact)
                ? 'Active now'
                : `Last seen: ${getLastSeen(activeContact)}`}
          </div>
        )}
      </div>

      <div className="px-5 py-3 bg-[#292C31] border-b border-black/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.3em] text-[#949BA4]">Chat Settings</p>
            <p className="text-sm text-[#DBDEE1]">Customize this conversation and keep privacy controls close.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isGroupChat && (
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#23262B] px-3 py-2">
                <input
                  key={activeRoom?.id || 'room-input'}
                  ref={roomNameInputRef}
                  defaultValue={activeRoom?.name || ''}
                  onBlur={() => {
                    if (!activeRoom || !roomNameInputRef.current) return;
                    const value = roomNameInputRef.current.value.trim();
                    onUpdateRoomName(activeRoom.id, value || activeRoom.name);
                  }}
                  className="bg-transparent outline-none text-sm text-white"
                  style={{ minWidth: 180 }}
                  placeholder="Edit room name"
                />
                <button
                  onClick={() => {
                    if (!activeRoom || !roomNameInputRef.current) return;
                    const value = roomNameInputRef.current.value.trim();
                    onUpdateRoomName(activeRoom.id, value || activeRoom.name);
                  }}
                  className="p-2 rounded-xl bg-[#5865F2] text-white hover:bg-[#4752C4]"
                >
                  <Bookmark size={16} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#23262B] px-3 py-2">
              <Palette size={16} className="text-[#949BA4]" />
              <select
                value={chatTheme}
                onChange={(e) => setChatTheme(e.target.value as 'midnight' | 'ocean' | 'forest' | 'slate')}
                className="bg-transparent outline-none text-sm text-white"
              >
                <option value="midnight">Midnight</option>
                <option value="ocean">Ocean</option>
                <option value="forest">Forest</option>
                <option value="slate">Slate</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      {(activeContact || activeRoom) && (
        <div className="px-5 py-2 text-xs text-[#94A0B4] border-b border-black/20">
          {currentMessages.length} message{currentMessages.length === 1 ? '' : 's'} · {unreadCount} unread
        </div>
      )}
      <div className="flex items-center justify-between px-5 py-3 bg-[#292C31] border-b border-black/20 gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#DBDEE1]">
          {activeContact || activeRoom ? (
            <>
              <button
                onClick={() => startCall('voice')}
                className="p-3 rounded-xl bg-[#23A559] hover:bg-[#1F8D43] transition"
                disabled={!activeContact && !activeRoom}
              >
                <PhoneCall size={18} />
              </button>
              <button
                onClick={() => startCall('video')}
                className="p-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] transition"
                disabled={!activeContact && !activeRoom}
              >
                <Video size={18} />
              </button>
              {inputValue.trim() && (
                <button
                  onClick={() => onSaveChat(getChatKey(), !savedChats[getChatKey()])}
                  className="px-3 py-2 rounded-xl border border-white/10 hover:bg-white/5 transition"
                >
                  {savedChats[getChatKey()] ? 'Saved' : 'Save chat'}
                </button>
              )}
              <button
                onClick={() => onPrivacyChange(!privacyMode)}
                className={`px-3 py-2 rounded-xl transition ${privacyMode ? 'bg-[#3B82F6] hover:bg-[#2563EB]' : 'bg-[#6B7280] hover:bg-[#4B5563]'}`}
              >
                {privacyMode ? 'Privacy On' : 'Privacy Off'}
              </button>
              {callStatus !== 'idle' && (
                <button
                  onClick={hangUp}
                  className="px-3 py-2 rounded-xl bg-[#EF4444] text-white hover:bg-[#DC2626] transition"
                >
                  End
                </button>
              )}
            </>
          ) : (
            <span className="text-[#949BA4]">Select a contact or group to start a secure session</span>
          )}
        </div>

        <div className="text-xs text-[#949BA4]">
          {callStatus === 'incoming' && `${callMode ? `${callMode.charAt(0).toUpperCase() + callMode.slice(1)} ` : ''}Incoming call...`}
          {callStatus === 'connecting' && `${callMode ? `${callMode.charAt(0).toUpperCase() + callMode.slice(1)} ` : ''}Connecting...`}
          {callStatus === 'connected' && `${callMode ? `${callMode.charAt(0).toUpperCase() + callMode.slice(1)} ` : ''}Call active`}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!activeContact && !activeRoom ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-[#2B2D31] rounded-3xl flex items-center justify-center mb-6">
              <Hash size={56} className="text-[#5865F2]" />
            </div>
            <h2 className="text-3xl font-black text-white">Welcome to Chat</h2>
            <p className="text-[#949BA4] mt-3">Select a contact or join a room to start chatting</p>
          </div>
        ) : (
          <>
            {/* Welcome Banner */}
            <div className="text-center mb-10">
              <div className="mx-auto w-20 h-20 bg-linear-to-br from-[#5865F2] to-indigo-600 rounded-3xl flex items-center justify-center text-4xl font-black mb-4">
                {isGroupChat ? '👥' : activeContact?.[0].toUpperCase()}
              </div>
              <h1 className="text-3xl font-black text-white">
                {isGroupChat ? activeRoom.name : `@${activeContact}`}
              </h1>
              <p className="text-[#949BA4] mt-1">
                {isGroupChat ? 'Group conversation' : 'Direct message • End-to-end encrypted'}
              </p>
            </div>

            {(callStatus === 'connecting' || callStatus === 'connected') && (
              <div className="grid gap-3 mb-6 lg:grid-cols-2">
                <div className="rounded-3xl bg-[#23262B] p-4">
                  <p className="text-sm text-[#949BA4] mb-2">Local camera</p>
                  <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-2xl bg-black h-60 object-cover" />
                </div>
                <div className="rounded-3xl bg-[#23262B] p-4">
                  <p className="text-sm text-[#949BA4] mb-2">Remote stream</p>
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-2xl bg-black h-60 object-cover" />
                </div>
              </div>
            )}

            {incomingCall && (
              <div className="rounded-3xl border border-[#5865F2] bg-[#23262B] p-5 mb-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">Incoming {incomingCall.callType} call from @{incomingCall.from}</p>
                    <p className="text-sm text-[#949BA4]">Accept to connect securely with audio/video.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={declineCall} className="px-4 py-2 rounded-xl bg-[#A855F7] hover:bg-[#9333EA] transition text-white">Decline</button>
                    <button onClick={acceptCall} className="px-4 py-2 rounded-xl bg-[#23A559] hover:bg-[#1F8D43] transition text-white">Accept</button>
                  </div>
                </div>
              </div>
            )}

            {currentMessages.map((msg) => {
              const isOwnMessage = msg.from === username;
              const hasReadByOthers = msg.readBy?.some((user) => user !== username) ?? false;
              const isDelivered = !!msg.isDelivered;

              return (
                <div key={msg.id} className={`flex gap-4 ${isOwnMessage ? 'justify-end' : ''}`}>
                  {!isOwnMessage && (
                    <div className="w-10 h-10 rounded-full bg-[#1E1F22] flex items-center justify-center font-bold text-[#5865F2]">
                      {msg.from[0].toUpperCase()}
                    </div>
                  )}

                  <div className={`max-w-[65%] ${isOwnMessage ? 'items-end' : ''}`}>
                    <div className="flex items-baseline gap-2">
                      {!isOwnMessage && <span className="font-bold text-white">@{msg.from}</span>}
                      <span className="text-xs text-[#949BA4]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className={`px-4 py-2.5 rounded-2xl ${isOwnMessage ? 'bg-[#5865F2] text-white' : 'bg-[#383A40]'}`}>
                      {msg.text}
                    </div>

                    {/* Read Receipts */}
                    {isOwnMessage && (
                      <div className="flex justify-end mt-1">
                        {hasReadByOthers ? (
                          <CheckCheck size={16} className="text-[#23A559]" />
                        ) : isDelivered ? (
                          <CheckCheck size={16} className="text-[#949BA4]" />
                        ) : (
                          <Check size={16} className="text-[#949BA4]" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {(activeContact && typingUsers[activeContact]) || activeRoomTypingUsers.length > 0 ? (
              <div className="flex gap-4 pl-14">
                <div className="text-[#23A559] text-sm flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span>
                    {activeRoomTypingUsers.length > 0
                      ? activeRoomTypingUsers.length === 1
                        ? `@${activeRoomTypingUsers[0]} is typing...`
                        : `${activeRoomTypingUsers.length} people are typing...`
                      : `@${activeContact} is typing...`}
                  </span>
                </div>
              </div>
            ) : null}
          </>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 pb-8 bg-[#313338]">
        <div className="bg-[#383A40] rounded-2xl flex items-center px-5 py-3 border border-white/5">
          <input
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={activeContact || activeRoom ? `Message ${activeRoom ? activeRoom.name : '@' + activeContact}...` : "Select a chat..."}
            className="flex-1 bg-transparent outline-none text-[15px]"
            disabled={!activeContact && !activeRoom}
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || (!activeContact && !activeRoom)}
            className="ml-3 text-[#5865F2] hover:text-[#7289DA] disabled:opacity-40"
          >
            <Send size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;