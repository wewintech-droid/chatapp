import React from 'react';
import { MessageSquare } from 'lucide-react';

interface LoginScreenProps {
  email: string;
  setEmail: (email: string) => void;
  authError: string;
  onSubmit: (e: React.FormEvent) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ email, setEmail, authError, onSubmit }) => (
  <div className="flex items-center justify-center min-h-screen bg-[#1E1F22]">
    <div className="w-full max-w-sm p-8 bg-[#313338] rounded-2xl border border-white/5">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-[#5865F2] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <MessageSquare size={32} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white">Chat</h1>
      </div>
      <form onSubmit={onSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          className="w-full bg-[#1E1F22] p-4 rounded-xl text-white outline-none focus:ring-2 focus:ring-[#5865F2] mb-4"
          required
        />
        {authError && <p className="text-red-500 text-sm mb-4">{authError}</p>}
        <button
          type="submit"
          className="w-full bg-[#5865F2] py-3.5 rounded-xl font-bold text-white hover:bg-[#4752C4] transition"
        >
          Continue
        </button>
      </form>
    </div>
  </div>
);

export default LoginScreen;