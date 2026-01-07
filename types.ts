
export interface User {
  email: string;
  name: string;
}

export interface Attachment {
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  mimeType: string;
  base64?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  attachments?: Attachment[];
  audioUrl?: string;
  videoUrl?: string;
  generatedImageUrl?: string;
  isVideoLoading?: boolean;
  isImageLoading?: boolean;
  isBookmarked?: boolean;
  feedback?: 'up' | 'down' | null;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
}

export type Language = 'en' | 'hi' | 'te';

export const LANGUAGES = {
  en: { name: 'English', label: 'English' },
  hi: { name: 'Hindi', label: 'हिन्दी' },
  te: { name: 'Telugu', label: 'తెలుగు' }
};

export type Theme = 'light' | 'dark';
