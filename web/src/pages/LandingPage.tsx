import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, GraduationCap, FileText, ArrowRight, Clock, LogIn, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

import { useAuth } from '../auth/AuthContext';

const searchTypes = [
  {
    id: 'job',
    title: 'Jobs',
    description: 'Find verified roles matching your skills and visa requirements.',
    icon: Briefcase,
    time: '2–5 min',
    color: 'bg-neutral-50 text-neutral-900 border-neutral-100',
    hoverColor: 'hover:border-neutral-300 hover:shadow-neutral-100',
  },
  {
    id: 'scholarship',
    title: 'Scholarships',
    description: 'Discover fully-funded opportunities for your next degree.',
    icon: GraduationCap,
    time: '3–6 min',
    color: 'bg-neutral-50 text-neutral-900 border-neutral-100',
    hoverColor: 'hover:border-neutral-300 hover:shadow-neutral-100',
  },
  {
    id: 'visa',
    title: 'Visa Requirements',
    description: 'Get structured checklists for your target country.',
    icon: FileText,
    time: '2–4 min',
    color: 'bg-neutral-50 text-neutral-900 border-neutral-100',
    hoverColor: 'hover:border-neutral-300 hover:shadow-neutral-100',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleStart = () => {
    if (isAuthenticated) {
      navigate('/new-search');
      return;
    }

    navigate('/auth?next=%2Fnew-search');
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 text-neutral-900 text-xs font-semibold mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-500"></span>
          </span>
          AI-POWERED SEARCH WORKSPACE
        </div>
        <h1 className="text-[40px] font-bold tracking-tight leading-tight mb-4">
          Find verified opportunities faster.
        </h1>
        <p className="text-lg text-neutral-500 max-w-lg mx-auto">
          Use a guided search flow to set your goals, filters, and profile context before running a search. You now need an account before search can begin.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mb-12">
        {searchTypes.map((type, index) => (
          <motion.div
            key={type.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className={`group relative flex flex-col items-start p-8 rounded-2xl border-2 text-left transition-all duration-300 bg-white border-neutral-100 ${type.hoverColor} hover:shadow-lg`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${type.color}`}>
              <type.icon size={24} />
            </div>
            <h3 className="text-xl font-bold mb-2">{type.title}</h3>
            <p className="text-sm text-neutral-500 leading-relaxed mb-6">
              {type.description}
            </p>
            <div className="mt-auto flex items-center gap-2 text-xs font-medium text-neutral-400">
              <Clock size={14} />
              Estimated time: {type.time}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-4 w-full max-w-xs md:max-w-none"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-100">
          <Sparkles size={12} />
          Search now starts after sign-in or registration
        </div>
        <button
          onClick={handleStart}
          className="w-full md:w-auto px-10 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 min-h-[56px] bg-neutral-900 text-white hover:bg-black shadow-xl shadow-neutral-200 active:scale-95"
        >
          {isAuthenticated ? 'Go to New Search' : 'Create Account to Start Search'}
          <ArrowRight size={20} />
        </button>

        {!isAuthenticated && (
          <button
            type="button"
            onClick={() => navigate('/auth?next=%2Fnew-search')}
            className="text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors py-2 inline-flex items-center gap-2"
          >
            <LogIn size={16} />
            Sign in to continue
          </button>
        )}
      </motion.div>
      
      <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-12 opacity-30 grayscale">
        <div className="flex items-center justify-center font-bold text-xl tracking-tighter">TECHCORP</div>
        <div className="flex items-center justify-center font-bold text-xl tracking-tighter">GLOBALEDU</div>
        <div className="flex items-center justify-center font-bold text-xl tracking-tighter">VISAFIRST</div>
        <div className="flex items-center justify-center font-bold text-xl tracking-tighter">JOBSTREAM</div>
      </div>
    </div>
  );
}
