import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { History, User, Menu, X } from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const isNewSearchRoute = location.pathname.startsWith('/new-search') || location.pathname.startsWith('/intake/');
  
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-neutral-200">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
            <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white font-bold">
              T
            </div>
            <span className="text-xl font-bold tracking-tight">TinyFinder</span>
          </Link>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link 
              to="/new-search"
              className={`text-sm font-medium transition-colors hover:text-neutral-900 ${isNewSearchRoute ? 'text-neutral-900' : 'text-neutral-500'}`}
            >
              New Search
            </Link>
            <button className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors flex items-center gap-1">
              <History size={16} />
              History
            </button>
            <div className="h-4 w-px bg-neutral-200" />
            <Link 
              to="/profile"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${location.pathname === '/profile' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}
            >
              <User size={18} />
            </Link>
          </nav>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-neutral-500 hover:text-neutral-900 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-neutral-100 p-4 space-y-4 shadow-xl animate-in slide-in-from-top duration-200">
            <Link 
              to="/new-search"
              onClick={() => setIsMenuOpen(false)}
              className={`block text-lg font-bold p-2 rounded-xl ${isNewSearchRoute ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600'}`}
            >
              New Search
            </Link>
            <button className="w-full text-left text-lg font-bold p-2 text-neutral-600 rounded-xl hover:bg-neutral-50 flex items-center gap-2">
              <History size={20} />
              History
            </button>
            <Link 
              to="/profile"
              onClick={() => setIsMenuOpen(false)}
              className={`block text-lg font-bold p-2 rounded-xl ${location.pathname === '/profile' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600'}`}
            >
              Profile & Settings
            </Link>
          </div>
        )}
      </header>
      
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {children}
      </main>
      
      <footer className="max-w-[1200px] mx-auto px-4 md:px-6 py-12 border-top border-neutral-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-6 h-6 bg-neutral-400 rounded flex items-center justify-center text-white text-xs font-bold">
              T
            </div>
            <span className="text-sm font-medium">TinyFinder © 2026</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-sm text-neutral-400">
            <a href="#" className="hover:text-neutral-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-neutral-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-neutral-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
