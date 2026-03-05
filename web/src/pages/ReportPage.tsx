import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, Download, Share2, Mail, FileText, 
  ArrowRight, RefreshCw, Star, TrendingUp, Search,
  ExternalLink, Bookmark, MapPin, Building2
} from 'lucide-react';
import { motion } from 'motion/react';

export function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const stats = [
    { label: 'Total Found', value: '52', icon: Search, color: 'bg-neutral-100 text-neutral-900' },
    { label: 'Shortlisted', value: '12', icon: TrendingUp, color: 'bg-neutral-100 text-neutral-900' },
    { label: 'Saved', value: '8', icon: Star, color: 'bg-neutral-100 text-neutral-900' },
    { label: 'Applied', value: '3', icon: CheckCircle2, color: 'bg-neutral-100 text-neutral-900' },
  ];

  const topMatches = [
    {
      id: '1',
      title: 'Senior Backend Engineer',
      organization: 'TechFlow GmbH',
      location: 'Berlin, Germany',
      fitScore: '98%',
      tags: ['Visa Sponsorship', 'Hybrid', 'Senior'],
    },
    {
      id: '3',
      title: 'Cloud Architect',
      organization: 'DataScale',
      location: 'Remote (Germany)',
      fitScore: '95%',
      tags: ['Remote', 'High Salary', 'Senior'],
    },
    {
      id: '4',
      title: 'Backend Developer (Node.js)',
      organization: 'FinLeap',
      location: 'Berlin, Germany',
      fitScore: '92%',
      tags: ['Visa Sponsorship', 'On-site', 'Mid-level'],
    },
  ];

  return (
    <div className="space-y-8 py-4">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-neutral-900" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Search Report: Backend Roles Germany</h1>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-100">
                Completed
              </span>
            </div>
            <p className="text-neutral-500">Generated on {new Date().toLocaleDateString()} • Session ID: {id}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black shadow-xl shadow-neutral-200 active:scale-95 transition-all min-h-[48px]"
            >
              <RefreshCw size={20} />
              Run Again
            </button>
            <div className="flex items-center gap-2">
              <button className="p-3 bg-neutral-50 text-neutral-600 rounded-xl hover:bg-neutral-100 transition-all border border-neutral-200">
                <Share2 size={20} />
              </button>
              <button className="p-3 bg-neutral-50 text-neutral-600 rounded-xl hover:bg-neutral-100 transition-all border border-neutral-200">
                <Download size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl border border-neutral-200 p-4 md:p-6 shadow-sm hover:shadow-md transition-all"
          >
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center mb-3 md:mb-4 ${stat.color}`}>
              <stat.icon size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl md:text-3xl font-bold text-neutral-900">{stat.value}</span>
              <span className="text-xs md:text-sm font-medium text-neutral-500">{stat.label}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Top Matches Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-bold text-neutral-900">Top Ranked Matches</h2>
            <button className="text-sm font-bold text-neutral-900 hover:underline flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          
          <div className="space-y-4">
            {topMatches.map((match) => (
              <div key={match.id} className="bg-white border border-neutral-200 rounded-2xl p-5 md:p-6 shadow-sm hover:border-neutral-400 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-neutral-900 group-hover:text-black transition-colors">{match.title}</h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-neutral-500">
                      <span className="flex items-center gap-1.5"><Building2 size={14} /> {match.organization}</span>
                      <span className="flex items-center gap-1.5"><MapPin size={14} /> {match.location}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-bold text-emerald-600">{match.fitScore}</span>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest hidden sm:block">Match Score</span>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-6">
                  {match.tags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-neutral-50 text-neutral-600 rounded-lg text-xs font-medium border border-neutral-100">
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 border-t border-neutral-50">
                  <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-all">
                      <Bookmark size={18} />
                      Save
                    </button>
                    <button className="flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-emerald-600 transition-all">
                      <CheckCircle2 size={18} />
                      Shortlist
                    </button>
                  </div>
                  <button className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all min-h-[44px]">
                    View Details
                    <ExternalLink size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Sections */}
        <div className="space-y-8">
          {/* Recommended Improvements */}
          <div className="bg-neutral-900 rounded-3xl p-6 text-white shadow-xl shadow-neutral-100">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <TrendingUp size={20} />
              Boost Your Match
            </h3>
            <p className="text-neutral-300 text-sm mb-6 leading-relaxed">
              We've identified a few ways to improve your search results for this session.
            </p>
            <div className="space-y-4">
              {[
                'Add "Kubernetes" to your skill keywords',
                'Broaden location to include Netherlands',
                'Update CV with recent Node.js projects',
              ].map((tip) => (
                <div key={tip} className="flex items-start gap-3 p-3 bg-white/10 rounded-xl border border-white/10">
                  <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5">
                    +
                  </div>
                  <span className="text-xs font-medium">{tip}</span>
                </div>
              ))}
            </div>
            <button className="w-full mt-8 py-3 bg-white text-neutral-900 rounded-xl font-bold hover:bg-neutral-100 transition-all">
              Update Criteria
            </button>
          </div>

          {/* Export Section */}
          <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4">Export & Share</h3>
            <div className="space-y-3">
              <button className="w-full flex items-center justify-between p-4 rounded-xl border border-neutral-100 hover:border-neutral-400 hover:bg-neutral-50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center group-hover:bg-red-100">
                    <FileText size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-neutral-900">PDF Report</p>
                    <p className="text-[10px] text-neutral-500">Detailed session summary</p>
                  </div>
                </div>
                <Download size={18} className="text-neutral-300 group-hover:text-neutral-900" />
              </button>
              
              <button className="w-full flex items-center justify-between p-4 rounded-xl border border-neutral-100 hover:border-neutral-400 hover:bg-neutral-50 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neutral-100 text-neutral-900 rounded-xl flex items-center justify-center group-hover:bg-neutral-200">
                    <Mail size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-neutral-900">Email Digest</p>
                    <p className="text-[10px] text-neutral-500">Weekly updates for this search</p>
                  </div>
                </div>
                <Share2 size={18} className="text-neutral-300 group-hover:text-neutral-900" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
