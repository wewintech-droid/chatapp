import React from 'react';
import { X } from 'lucide-react';

interface AddContactModalProps {
  searchUser: string;
  setSearchUser: (value: string) => void;
  onClose: () => void;
  onAdd: () => void;
}

const AddContactModal: React.FC<AddContactModalProps> = ({
  searchUser,
  setSearchUser,
  onClose,
  onAdd,
}) => {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#313338] w-full max-w-md rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Add New Connection</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={22} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-[#949BA4] mb-4">
            Enter the username of the person you want to connect with
          </p>

          <div className="relative mb-6">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5865F2] font-bold">@</span>
            <input
              autoFocus
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value.toLowerCase().trim())}
              placeholder="username"
              className="w-full bg-[#1E1F22] pl-10 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-[#5865F2] text-white"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-3 text-white font-medium hover:bg-[#3A3C43] rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={onAdd}
              disabled={!searchUser}
              className="px-8 py-3 bg-[#5865F2] font-semibold rounded-xl hover:bg-[#4752C4] transition disabled:opacity-50"
            >
              Open Direct Line
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddContactModal;