import React from 'react';

interface UsernameSetupProps {
  username: string;
  setUsername: (username: string) => void;
  authError: string;
  onSubmit: (e: React.FormEvent) => void;
}

const UsernameSetup: React.FC<UsernameSetupProps> = ({ username, setUsername, authError, onSubmit }) => (
  <div className="flex items-center justify-center min-h-screen bg-[#1E1F22]">
    <div className="w-full max-w-sm p-8 bg-[#313338] rounded-2xl">
      <h1 className="text-2xl font-bold text-center mb-6 text-white">Choose Username</h1>
      <form onSubmit={onSubmit}>
        <div className="relative mb-6">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5865F2] font-bold">@</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
            placeholder="username"
            className="w-full bg-[#1E1F22] pl-10 p-4 rounded-xl text-white outline-none focus:ring-2 focus:ring-[#5865F2]"
            required
          />
        </div>
        {authError && <p className="text-red-500 text-sm mb-4">{authError}</p>}
        <button
          type="submit"
          className="w-full bg-[#23A559] py-3.5 rounded-xl font-bold text-white hover:bg-[#1A7F43]"
        >
          Enter Chat
        </button>
      </form>
    </div>
  </div>
);

export default UsernameSetup;