
import React, { useState } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  theme: 'light' | 'dark';
}

const Login: React.FC<LoginProps> = ({ onLogin, theme }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password && (!isSignUp || name)) {
      // Mock login: Accept anything for demo purposes
      onLogin({ email, name: name || email.split('@')[0] });
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1a1917]' : 'bg-[#faf7f2]'}`}>
      <div className={`w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border-2 transition-colors duration-300 ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-100'}`}>
        <div className="flex flex-col items-center mb-8">
          <div className="bg-emerald-600 p-4 rounded-3xl shadow-xl mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21c4.418 0 8-3.582 8-8s-3.582-8-8-8-8 3.582-8 8 3.582 8 8 8z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21V13m0 0l-4 4m4-4l4 4m-4-8a4 4 0 110-8 4 4 0 010 8z" />
            </svg>
          </div>
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>AgriMate</h1>
          <p className="text-stone-500 text-sm mt-2">Welcome to your farming assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-5 py-4 rounded-2xl border-2 transition-all focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-100 text-stone-900'}`}
                placeholder="John Doe"
              />
            </div>
          )}
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-5 py-4 rounded-2xl border-2 transition-all focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-100 text-stone-900'}`}
              placeholder="farmer@example.com"
            />
          </div>
          <div>
            <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-5 py-4 rounded-2xl border-2 transition-all focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none ${theme === 'dark' ? 'bg-stone-800 border-stone-700 text-white' : 'bg-stone-50 border-stone-100 text-stone-900'}`}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95 mt-4"
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-emerald-600 font-bold text-sm hover:underline"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
