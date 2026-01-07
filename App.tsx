
import React, { useState, useRef, useEffect } from 'react';
import { Message, Language, LANGUAGES, Attachment, Theme, ChatSession, User } from './types';
import { agriGemini } from './services/geminiService';
import CameraModal from './components/CameraModal';
import Login from './components/Login';

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const WELCOME_MESSAGE: Message = {
  id: '1',
  role: 'model',
  content: "Hello! Welcome to AgriMate. I'm here to help you learn about crops and how they grow. I can look at your pictures or answer your questions in simple words. How can I help you today?",
  timestamp: new Date(),
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<Theme>('light');
  const [isRecording, setIsRecording] = useState(false);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) setTheme(savedTheme);

    const savedUser = localStorage.getItem('agri_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const savedHistory = localStorage.getItem('agri_chat_history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed.map((s: any) => ({
          ...s,
          timestamp: new Date(s.timestamp),
          messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        })));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    localStorage.setItem('agri_chat_history', JSON.stringify(history));
  }, [history]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('agri_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    saveCurrentToHistory();
    setUser(null);
    localStorage.removeItem('agri_user');
  };

  const saveCurrentToHistory = () => {
    if (messages.length <= 1) return;
    const userFirstMsg = messages.find(m => m.role === 'user');
    const title = userFirstMsg ? (userFirstMsg.content.slice(0, 30) || "Image Analysis") : "Farming Query";
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: title + (title.length >= 30 ? "..." : ""),
      messages: [...messages],
      timestamp: new Date(),
    };
    setHistory(prev => {
      const filtered = prev.filter(p => p.id !== newSession.id);
      return [newSession, ...filtered];
    });
  };

  const newChat = () => {
    saveCurrentToHistory();
    setMessages([{ ...WELCOME_MESSAGE, id: Date.now().toString(), timestamp: new Date() }]);
    setAttachments([]);
  };

  const loadSession = (session: ChatSession) => {
    saveCurrentToHistory();
    setMessages(session.messages);
    setAttachments([]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setAttachments(prev => [...prev, {
            type: 'audio', url: URL.createObjectURL(audioBlob), mimeType: 'audio/webm', base64
          }]);
        };
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) { alert("Microphone access denied."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;
      let type: Attachment['type'] = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      if (file.type.startsWith('video/')) type = 'video';
      if (file.type.startsWith('audio/')) type = 'audio';
      newAttachments.push({ type, url: URL.createObjectURL(file), mimeType: file.type, base64 });
    }
    setAttachments([...attachments, ...newAttachments]);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input, attachments: [...attachments], timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const historyLog = messages.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
      const response = await agriGemini.sendMessage(historyLog, input, userMsg.attachments, language);
      const modelMsg: Message = { id: (Date.now() + 1).toString(), role: 'model', content: response || "Something went wrong.", timestamp: new Date() };
      setMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', content: "Connection error. Please try again later.", timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  };

  const playAudio = async (msgId: string, content: string) => {
    try {
      const base64Audio = await agriGemini.generateSpeech(content);
      if (base64Audio) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        const audioData = decodeBase64(base64Audio);
        const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, audioUrl: 'played' } : m));
      }
    } catch (e) { console.error("Speech generation failed", e); }
  };

  const generateImage = async (msgId: string, content: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isImageLoading: true } : m));
    try {
      const imageUrl = await agriGemini.generateImage(content.slice(0, 500));
      if (imageUrl) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, generatedImageUrl: imageUrl, isImageLoading: false } : m));
      } else {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isImageLoading: false } : m));
      }
    } catch (e) {
      console.error("Image generation failed", e);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isImageLoading: false } : m));
    }
  };

  const generateVideo = async (msgId: string, content: string) => {
    if (!(window as any).aistudio?.hasSelectedApiKey()) await (window as any).aistudio?.openSelectKey();
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isVideoLoading: true } : m));
    try {
      const videoUrl = await agriGemini.generateVideo(content.slice(0, 500));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, videoUrl, isVideoLoading: false } : m));
    } catch (e) {
      console.error("Video generation failed", e);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isVideoLoading: false } : m));
    }
  };

  const toggleBookmark = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isBookmarked: !m.isBookmarked } : m));
  };

  const setFeedback = (msgId: string, type: 'up' | 'down') => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: type } : m));
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    alert("Copied to clipboard!");
  };

  const shareChat = async () => {
    const lastContent = messages.filter(m => m.role === 'model').pop()?.content || "AgriMate Farming Assistance";
    const shareData = {
      title: 'AgriMate Chat Session',
      text: `Look at this agricultural advice from AgriMate: "${lastContent.slice(0, 100)}..."`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Chat link copied to clipboard!");
      }
    } catch (err) {
      console.error('Sharing failed:', err);
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} theme={theme} />;
  }

  const filteredHistory = history.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.messages.some(m => m.content.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={`flex h-full w-full overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-[#1a1917] text-white' : 'bg-[#faf7f2] text-stone-900'}`}>
      {/* Sidebar with Cyan Background */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 ${theme === 'dark' ? 'bg-cyan-950' : 'bg-cyan-600'} flex flex-col overflow-hidden text-white shadow-2xl z-20`}>
        <div className="p-5 border-b border-cyan-700/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-xl shadow-lg">
              <img 
                src="https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?q=80&w=200&auto=format&fit=crop" 
                alt="Plant Logo" 
                className="w-8 h-8 rounded-lg object-cover"
              />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">AgriMate</span>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-5 flex-1 overflow-hidden">
          <button onClick={newChat} className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-3 transition-colors shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            <span className="font-semibold text-sm">New Session</span>
          </button>

          <div className="relative">
            <input 
              type="text" 
              placeholder="Search history..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-cyan-800/50 border-none rounded-xl py-2.5 px-4 pl-10 text-xs text-white placeholder-cyan-200 focus:ring-2 focus:ring-white/50"
            />
            <svg className="w-4 h-4 absolute left-3.5 top-3 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          
          <div className="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-widest font-bold text-cyan-100/60 px-2 mb-3">History</p>
              {filteredHistory.length > 0 ? filteredHistory.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/10 text-cyan-50 group transition-colors truncate text-xs flex flex-col gap-1"
                >
                  <span className="font-semibold text-white group-hover:text-cyan-200 truncate">{session.title}</span>
                  <span className="text-[10px] opacity-60">{session.timestamp.toLocaleDateString()}</span>
                </button>
              )) : (
                <div className="px-3 py-2 text-[10px] text-cyan-200/50 italic">No previous sessions found</div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-[11px] uppercase tracking-widest font-bold text-cyan-100/60 px-2 mb-3">Language</p>
              <div className="grid grid-cols-1 gap-2">
                {Object.entries(LANGUAGES).map(([code, lang]) => (
                  <button
                    key={code}
                    onClick={() => setLanguage(code as Language)}
                    className={`text-left px-4 py-2.5 rounded-xl transition-all flex items-center justify-between shadow-sm border ${language === code ? 'bg-white text-cyan-900 border-white ring-2 ring-white/20' : 'bg-cyan-700/30 hover:bg-white/10 text-white border-transparent'}`}
                  >
                    <span className="text-xs font-bold">{lang.name}</span>
                    <span className="text-[10px] font-medium opacity-70">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-cyan-700 flex flex-col gap-2">
           <div className="flex items-center gap-3 px-2 py-2 mb-2">
             <div className="w-8 h-8 rounded-full bg-white text-cyan-600 flex items-center justify-center text-xs font-bold">
               {user.name[0].toUpperCase()}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-xs font-bold text-white truncate">{user.name}</p>
               <p className="text-[10px] text-cyan-200 truncate">{user.email}</p>
             </div>
           </div>
           <button onClick={handleLogout} className="w-full py-2 px-4 rounded-lg bg-cyan-800/40 hover:bg-red-500/20 text-white hover:text-red-300 text-xs font-bold transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full dark:bg-[#1a1917] transition-colors duration-300">
        <header className={`h-16 border-b flex items-center px-6 justify-between transition-colors duration-300 ${theme === 'dark' ? 'bg-stone-900/90 border-stone-800' : 'bg-white/90 border-stone-200'} backdrop-blur-md sticky top-0 z-10`}>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-stone-600 dark:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex flex-col">
              <h2 className="text-sm font-bold flex items-center gap-2 dark:text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                {messages.length > 1 ? "Analysis in Progress" : "AgriMate Assistant"}
              </h2>
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">Safe Educational AI</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={shareChat}
              className="p-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-stone-600 dark:text-white transition-colors shadow-sm border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
              title="Share Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl text-stone-600 dark:text-white transition-colors shadow-sm border border-transparent hover:border-stone-200 dark:hover:border-stone-700"
              title="Toggle Theme"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" /></svg>
              )}
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto py-10 px-6 space-y-12">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-6 items-start ${msg.role === 'model' ? 'bg-white dark:bg-stone-900/60 -mx-6 px-8 py-10 rounded-[3rem] shadow-sm border border-stone-100 dark:border-stone-800' : ''}`}>
                <div className={`w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center font-bold text-[13px] shadow-md border ${msg.role === 'model' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-white border-stone-200 dark:border-stone-700'}`}>
                  {msg.role === 'model' ? 'AI' : 'ME'}
                </div>
                <div className="flex-1 min-w-0 space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className={`leading-relaxed whitespace-pre-wrap text-[16px] flex-1 ${theme === 'dark' ? 'text-white font-normal' : 'text-stone-800 font-medium'}`}>
                      {msg.content}
                    </div>
                    {msg.role === 'model' && (
                      <div className="flex flex-col gap-2">
                        <button onClick={() => copyContent(msg.content)} className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-400 hover:text-stone-600 transition-colors" title="Copy Content">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                        <button onClick={() => toggleBookmark(msg.id)} className={`p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors ${msg.isBookmarked ? 'text-amber-500' : 'text-stone-400'}`} title="Bookmark Output">
                          <svg className="w-4 h-4" fill={msg.isBookmarked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {msg.role === 'model' && msg.content && !msg.content.includes("Welcome") && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-3 pt-3">
                        <button onClick={() => playAudio(msg.id, msg.content)} className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-xs font-bold hover:bg-stone-200 dark:hover:bg-stone-700 transition-all dark:text-white shadow-sm border border-stone-200 dark:border-stone-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                          Listen (Audio)
                        </button>
                        <button onClick={() => generateImage(msg.id, msg.content)} className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all shadow-sm border border-amber-200 dark:border-amber-800" disabled={msg.isImageLoading}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          {msg.isImageLoading ? 'Drawing...' : 'View Picture'}
                        </button>
                        <button onClick={() => generateVideo(msg.id, msg.content)} className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-all shadow-sm border border-emerald-200 dark:border-emerald-800" disabled={msg.isVideoLoading}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          {msg.isVideoLoading ? 'Making Video...' : 'Watch Video'}
                        </button>
                      </div>

                      {/* Feedback UI */}
                      <div className="flex items-center gap-4 py-2 border-t border-stone-100 dark:border-stone-800">
                        <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">Helpful?</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setFeedback(msg.id, 'up')}
                            className={`p-1.5 rounded-lg transition-all ${msg.feedback === 'up' ? 'bg-emerald-100 text-emerald-600 scale-110' : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400'}`}
                          >
                            <svg className="w-4 h-4" fill={msg.feedback === 'up' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.708c.217 0 .406.144.459.354l1.357 5.43c.123.49-.247.966-.753.966H14v4a2 2 0 01-4 0v-4H5a1 1 0 01-1-1V9a1 1 0 011-1h3v-3a2 2 0 114 0v3h2v2z" /></svg>
                          </button>
                          <button 
                            onClick={() => setFeedback(msg.id, 'down')}
                            className={`p-1.5 rounded-lg transition-all ${msg.feedback === 'down' ? 'bg-red-100 text-red-600 scale-110' : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400'}`}
                          >
                            <svg className="w-4 h-4" fill={msg.feedback === 'down' ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.292a.465.465 0 01-.459-.354l-1.357-5.43A.774.774 0 014.23 7.25H10V3.25a2 2 0 014 0v4h5a1 1 0 011 1v7a1 1 0 01-1 1h-3v3a2 2 0 11-4 0v-3h-2v-2z" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {msg.generatedImageUrl && (
                    <div className="mt-6 rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-stone-800 shadow-2xl max-w-xl group relative">
                      <img src={msg.generatedImageUrl} className="w-full h-auto transition-transform duration-700 group-hover:scale-[1.05]" alt="Educational drawing" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  )}

                  {msg.videoUrl && (
                    <div className="mt-6 rounded-[2.5rem] overflow-hidden border-4 border-white dark:border-stone-800 shadow-2xl max-w-xl">
                      <video src={msg.videoUrl} controls className="w-full h-auto bg-stone-900" />
                    </div>
                  )}
                  
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-5 mt-5">
                      {msg.attachments.map((att, idx) => (
                        <div key={idx} className="relative group max-w-[280px] rounded-[2rem] overflow-hidden border-2 border-white dark:border-stone-800 shadow-lg transition-all hover:shadow-xl hover:scale-[1.03]">
                          {att.type === 'image' && <img src={att.url} className="w-full h-auto object-cover max-h-[350px]" />}
                          {att.type === 'audio' && <audio src={att.url} controls className="w-full h-10 px-3 py-1" />}
                          {att.type === 'video' && <video src={att.url} controls className="w-full h-auto" />}
                          {att.type === 'document' && <div className="p-6 bg-stone-50 dark:bg-stone-800 text-sm font-bold flex items-center gap-3 dark:text-white">📄 Research Doc</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-6 animate-pulse px-4">
                <div className="w-11 h-11 rounded-2xl bg-stone-200 dark:bg-stone-800" />
                <div className="flex-1 space-y-4 pt-2">
                  <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded-full w-4/5" />
                  <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded-full w-2/3" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="max-w-3xl mx-auto w-full p-6 mb-8">
          <div className="relative bg-white dark:bg-stone-900 border-2 border-stone-200 dark:border-stone-700 rounded-[2.5rem] shadow-2xl transition-all focus-within:ring-8 focus-within:ring-emerald-500/5 focus-within:border-emerald-500/40 overflow-hidden">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-4 p-5 bg-stone-50 dark:bg-stone-800/50 border-b border-stone-100 dark:border-stone-800">
                {attachments.map((att, idx) => (
                  <div key={idx} className="relative group">
                    <div className="w-24 h-24 rounded-3xl bg-white dark:bg-stone-800 border-2 border-stone-200 dark:border-stone-700 overflow-hidden flex items-center justify-center shadow-md">
                      {att.type === 'image' ? <img src={att.url} className="w-full h-full object-cover" /> : <span className="text-3xl">📎</span>}
                    </div>
                    <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="absolute -top-3 -right-3 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold hover:bg-red-500 dark:hover:bg-red-500 shadow-xl transition-all">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end p-4 gap-3">
              <div className="flex gap-1.5 pb-1">
                <button onClick={() => setIsCameraOpen(true)} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl text-stone-500 dark:text-white transition-all active:scale-90" title="Camera"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`p-3 rounded-2xl transition-all active:scale-90 ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-white'}`} title="Voice (Hold)"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg></button>
                <button onClick={() => fileInputRef.current?.click()} className="p-3 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-2xl text-stone-500 dark:text-white transition-all active:scale-90" title="Attach"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.415a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                <input type="file" ref={fileInputRef} multiple onChange={handleFileUpload} className="hidden" accept="image/*,video/*,audio/*,application/pdf" />
              </div>
              <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder="Ask a simple farming question..." className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-4 text-stone-800 dark:text-white text-[16px] font-medium resize-none max-h-48 scrollbar-hide placeholder-stone-400" />
              <button onClick={handleSend} disabled={isLoading || (!input.trim() && attachments.length === 0)} className={`p-4 rounded-[2rem] transition-all shadow-xl ${isLoading || (!input.trim() && attachments.length === 0) ? 'bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-700' : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'}`}><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg></button>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-stone-300 dark:bg-stone-700"></span>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 font-bold uppercase tracking-widest">AgriMate Assistant</p>
            <span className="h-px w-8 bg-stone-300 dark:bg-stone-700"></span>
          </div>
        </div>

        {isCameraOpen && <CameraModal onClose={() => setIsCameraOpen(false)} onCapture={(base64) => { setAttachments(prev => [...prev, { type: 'image', url: `data:image/jpeg;base64,${base64}`, mimeType: 'image/jpeg', base64 }]); }} />}
      </main>
    </div>
  );
};

export default App;
