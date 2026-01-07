
import React from 'react';

const Navigation: React.FC = () => {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <span className="text-xl font-bold text-stone-800 tracking-tight">AgriExplain</span>
          </div>
          <div className="hidden md:flex space-x-8">
            <a href="#chat" className="text-stone-600 hover:text-emerald-700 font-medium">Chat Assistant</a>
            <a href="#lifecycle" className="text-stone-600 hover:text-emerald-700 font-medium">Lifecycle Guide</a>
            <a href="#about" className="text-stone-600 hover:text-emerald-700 font-medium">About</a>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
