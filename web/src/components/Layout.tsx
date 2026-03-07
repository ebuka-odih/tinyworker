import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';

import { useAuth } from '../auth/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { authUser, isAuthenticated, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const authNext = encodeURIComponent('/new-search');
  const isSearchWorkspaceRoute = location.pathname.startsWith('/new-search') || location.pathname.startsWith('/intake/');
  
  const handleSignOut = () => {
    signOut();
    setIsMenuOpen(false);
    navigate('/auth?next=%2Fnew-search', { replace: true });
  };

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
            {isAuthenticated ? (
              <>
                <Link 
                  to="/new-search"
                  className={`text-sm font-medium transition-colors hover:text-neutral-900 ${isSearchWorkspaceRoute ? 'text-neutral-900' : 'text-neutral-500'}`}
                >
                  Search Workspace
                </Link>
                <Link
                  to="/profile"
                  className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${location.pathname === '/profile' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs font-bold uppercase">
                    {authUser?.email?.slice(0, 2).toUpperCase() || 'TW'}
                  </span>
                  <span className="max-w-[180px] truncate">{authUser?.email}</span>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to={`/auth?next=${authNext}`}
                  className="text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-900"
                >
                  Sign In
                </Link>
                <Link
                  to={`/auth?next=${authNext}`}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-black"
                >
                  Create Account
                </Link>
              </>
            )}
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
            {isAuthenticated ? (
              <>
                <Link 
                  to="/new-search"
                  onClick={() => setIsMenuOpen(false)}
                  className={`block text-lg font-bold p-2 rounded-xl ${isSearchWorkspaceRoute ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600'}`}
                >
                  Search Workspace
                </Link>
                <Link 
                  to="/profile"
                  onClick={() => setIsMenuOpen(false)}
                  className={`block text-lg font-bold p-2 rounded-xl ${location.pathname === '/profile' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-600'}`}
                >
                  Profile & Settings
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full text-left text-lg font-bold p-2 text-neutral-600 rounded-xl hover:bg-neutral-50 flex items-center gap-2"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to={`/auth?next=${authNext}`}
                  onClick={() => setIsMenuOpen(false)}
                  className="block text-lg font-bold p-2 rounded-xl text-neutral-600 hover:bg-neutral-50"
                >
                  Sign In
                </Link>
                <Link
                  to={`/auth?next=${authNext}`}
                  onClick={() => setIsMenuOpen(false)}
                  className="block rounded-xl bg-neutral-900 px-4 py-3 text-center text-lg font-bold text-white"
                >
                  Create Account
                </Link>
              </>
            )}
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
