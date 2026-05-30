import React from 'react';
import { Users, LogOut, Hash, MessageSquare } from 'lucide-react';
import type { Contact, Room } from '../types';

interface SidebarProps {
  contacts: Contact[];
  rooms: Room[];
  activeContact: string | null;
  activeRoom: Room | null;
  setActiveContact: (username: string | null) => void;
  setActiveRoom: (room: Room | null) => void;
  username: string;
  onCreateRoom: () => void;
  onAddContact: () => void;
  onToggleConnect: (username: string) => void;
  onIgnoreContact: (username: string) => void;
  onLogout: () => void;
  onlineUsers: Set<string>;
  typingUsers: Record<string, boolean>;
  activeChatUsers: Record<string, boolean>;
  unreadCounts: Record<string, number>;
  ignoredUsers: string[];
}

const Sidebar: React.FC<SidebarProps> = ({
  contacts,
  rooms,
  activeContact,
  activeRoom,
  setActiveContact,
  setActiveRoom,
  username,
  onCreateRoom,
  onAddContact,
  onToggleConnect,
  onIgnoreContact,
  onLogout,
  onlineUsers,
  typingUsers,
  activeChatUsers,
  unreadCounts,
  ignoredUsers,
}) => {
  return (
    <div className="w-72 bg-[#2B2D31] border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="h-14 flex items-center px-4 font-bold border-b border-black/20">
        Chat
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Online Users Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#949BA4]">Online Users</span>
            <span className="text-xs text-[#23A559]">{onlineUsers.size - (onlineUsers.has(username) ? 1 : 0)} active</span>
          </div>
          <p className="px-2 text-[10px] uppercase tracking-[0.3em] text-[#6B7280] mb-3">Tap Connect to start a private chat with someone online.</p>
          {Array.from(onlineUsers)
            .filter((user) => user !== username)
            .map((user) => {
              const isActiveChat = activeChatUsers[user] || activeContact === user;
              const isIgnored = ignoredUsers.includes(user);
              const unread = unreadCounts[user] || 0;
              return (
                <div key={user} className="flex flex-col gap-2 px-3 py-3 rounded-xl transition bg-[#22252A] hover:bg-[#2E3137] mb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">@{user}</p>
                        {typingUsers[user] && <span className="text-[#23A559] text-[11px] tracking-[0.14em] uppercase">typing...</span>}
                        {unread > 0 && <span className="text-[11px] bg-[#5865F2] text-white px-2 py-0.5 rounded-full">{unread}</span>}
                      </div>
                      <p className="text-xs text-[#949BA4]">
                        {isIgnored ? 'Ignored contact' : isActiveChat ? 'Connected' : 'Online now'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleConnect(user)}
                        className={`px-3 py-1 rounded-xl text-xs text-white transition ${isActiveChat ? 'bg-[#EF4444] hover:bg-[#DC2626]' : 'bg-[#5865F2] hover:bg-[#4752C4]'}`}
                      >
                        {isActiveChat ? 'Disconnect' : 'Connect'}
                      </button>
                      <button
                        onClick={() => onIgnoreContact(user)}
                        className={`px-3 py-1 rounded-xl text-xs transition ${isIgnored ? 'bg-[#6B7280] hover:bg-[#4B5563] text-white' : 'bg-[#1F2937] hover:bg-[#374151] text-[#D1D5DB]'}`}
                      >
                        {isIgnored ? 'Ignored' : 'Ignore'}
                      </button>
                    </div>
                  </div>
                </div>
              );
          })}
        </div>

        {/* Group Rooms Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#949BA4]">Group Rooms</span>
            <button onClick={onCreateRoom} className="text-[#23A559]">
              <Users size={18} />
            </button>
          </div>

          {rooms.map((room) => {
            const unread = unreadCounts[room.id] || 0;
            return (
              <div
                key={room.id}
                onClick={() => {
                  setActiveRoom(room);
                  setActiveContact(null);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-all
                  ${activeRoom?.id === room.id ? 'bg-[#404249]' : 'hover:bg-[#35373C]'}`}
              >
                <div className="w-9 h-9 bg-[#5865F2] rounded-xl flex items-center justify-center">
                  <Hash size={20} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{room.name}</p>
                    {unread > 0 && <span className="text-[11px] bg-[#5865F2] text-white px-2 py-0.5 rounded-full">{unread}</span>}
                  </div>
                  <p className="text-xs text-[#949BA4]">{room.participants.length} members</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Direct Messages Section */}
        <div>
          <div className="flex items-center justify-between px-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-widest text-[#949BA4]">Direct Messages</span>
            <button onClick={onAddContact} className="text-[#949BA4] hover:text-white">
              <MessageSquare size={18} />
            </button>
          </div>

          {contacts.map((contact) => {
            const isOnline = onlineUsers.has(contact.username);
            const isTyping = typingUsers[contact.username];
            const isActive = activeContact === contact.username;
            const unread = unreadCounts[contact.username] || 0;

            return (
              <div
                key={contact.username}
                onClick={() => {
                  setActiveContact(contact.username);
                  setActiveRoom(null);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer mb-1 transition-all
                  ${isActive ? 'bg-[#404249]' : 'hover:bg-[#35373C]'}`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#5865F2] to-indigo-600 flex items-center justify-center font-bold text-white">
                    {contact.username[0].toUpperCase()}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-[2.5px] border-[#2B2D31] 
                    ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">@{contact.username}</p>
                    {isTyping && <span className="text-[#23A559] text-[11px] tracking-[0.14em] uppercase">typing</span>}
                    {unread > 0 && <span className="text-[11px] bg-[#5865F2] text-white px-2 py-0.5 rounded-full">{unread}</span>}
                    {isActive && <span className="text-emerald-400 text-xs">● Active</span>}
                    {!isActive && activeChatUsers[contact.username] && <span className="text-[#23A559] text-xs">in chat</span>}
                  </div>

                  <div className="text-xs text-[#949BA4]">
                    {isTyping ? (
                      <span className="text-[#23A559]">typing...</span>
                    ) : isOnline ? (
                      'Active now'
                    ) : contact.lastSeen ? (
                      `Last seen ${new Date(contact.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    ) : (
                      'Offline'
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current User Footer */}
      <div className="p-3 bg-[#232428] border-t border-white/5 flex items-center gap-3">
        <div className="w-9 h-9 bg-[#23A559] rounded-full flex items-center justify-center font-bold text-white">
          {username[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <p className="font-bold">@{username}</p>
          <p className="text-xs text-emerald-500">● Online</p>
        </div>
        <button onClick={onLogout} className="text-gray-400 hover:text-red-400">
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;