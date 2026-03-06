import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Settings, Bookmark, Bell, Shield, LogOut, ChevronRight, MapPin, Building2, ExternalLink, AlertTriangle } from 'lucide-react';
import { SearchResult } from '../types';

export function ProfilePage() {
  const [activeTab, setActiveTab] = React.useState<'saved' | 'settings'>('saved');

  const savedItems: SearchResult[] = [
    {
      id: 's1',
      title: 'Senior Frontend Engineer',
      organization: 'Vibrant Tech',
      location: 'Berlin, Germany',
      fitScore: 'High',
      tags: ['Visa Sponsorship', 'Remote Friendly'],
      link: '#',
      status: 'saved',
      sourceName: 'LinkedIn Jobs',
      sourceDomain: 'linkedin.com',
      sourceType: 'job_board',
      sourceVerified: true,
      queueStatus: 'ready'
    },
    {
      id: 's2',
      title: 'Global Excellence Scholarship',
      organization: 'University of Toronto',
      location: 'Toronto, Canada',
      fitScore: 'High',
      tags: ['Fully Funded', 'Postgraduate'],
      link: '#',
      status: 'saved',
      sourceName: 'MyJobMag',
      sourceDomain: 'myjobmag.com',
      sourceType: 'job_board',
      sourceVerified: true,
      queueStatus: 'ready'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        {/* Sidebar */}
        <div className="w-full md:w-64 flex flex-col gap-2">
          <div className="p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm mb-2 md:mb-6 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-100 text-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="md:hidden" />
              <User size={40} className="hidden md:block" />
            </div>
            <h2 className="text-xl font-bold">Emma Gab</h2>
            <p className="text-sm text-neutral-500 truncate">emmagab38@gmail.com</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl font-bold transition-all min-h-[48px] ${
                activeTab === 'saved' ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200' : 'text-neutral-500 hover:bg-neutral-100 border border-neutral-100 md:border-transparent'
              }`}
            >
              <Bookmark size={20} />
              <span className="text-sm md:text-base">Saved</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-xl font-bold transition-all min-h-[48px] ${
                activeTab === 'settings' ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200' : 'text-neutral-500 hover:bg-neutral-100 border border-neutral-100 md:border-transparent'
              }`}
            >
              <Settings size={20} />
              <span className="text-sm md:text-base">Settings</span>
            </button>
          </div>
          
          <div className="pt-4 border-t border-neutral-200 mt-4 hidden md:block">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all min-h-[48px]">
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 w-full">
          <AnimatePresence mode="wait">
            {activeTab === 'saved' ? (
              <motion.div
                key="saved"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-bold">Saved Opportunities</h3>
                  <span className="text-sm font-medium text-neutral-400">{savedItems.length} items</span>
                </div>

                <div className="grid gap-4">
                  {savedItems.map((item) => (
                    <div key={item.id} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:border-neutral-400 transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-bold text-neutral-900 group-hover:text-black transition-colors">{item.title}</h4>
                            {item.isSuspicious && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold border border-red-100">
                                <AlertTriangle size={10} />
                                Suspicious
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
                            <span className="flex items-center gap-1.5"><Building2 size={14} /> {item.organization}</span>
                            <span className="flex items-center gap-1.5"><MapPin size={14} /> {item.location}</span>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.fitScore === 'High' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {item.fitScore} Fit
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-6">
                        {item.tags.map(tag => (
                          <span key={tag} className="px-2.5 py-1 bg-neutral-50 text-neutral-600 rounded-lg text-xs font-medium border border-neutral-100">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
                        <button className="text-sm font-bold text-red-500 hover:text-red-600 flex items-center gap-1.5">
                          <Bookmark size={16} className="fill-current" />
                          Remove
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-bold hover:bg-neutral-800 transition-all">
                          View Details
                          <ExternalLink size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <h3 className="text-2xl font-bold">Settings</h3>
                
                <div className="space-y-6">
                  <section className="space-y-4">
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <Bell size={16} />
                      Notifications
                    </h4>
                    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                      <div className="p-4 flex items-center justify-between border-b border-neutral-100">
                        <div>
                          <p className="font-bold">Email Alerts</p>
                          <p className="text-xs text-neutral-500">Get notified about new matches</p>
                        </div>
                        <div className="w-10 h-5 bg-neutral-900 rounded-full relative">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold">Weekly Digest</p>
                          <p className="text-xs text-neutral-500">Summary of your search activity</p>
                        </div>
                        <div className="w-10 h-5 bg-neutral-200 rounded-full relative">
                          <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                      <Shield size={16} />
                      Privacy & Security
                    </h4>
                    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                      <div className="p-4 flex items-center justify-between border-b border-neutral-100">
                        <div>
                          <p className="font-bold">Public Profile</p>
                          <p className="text-xs text-neutral-500">Allow others to see your search history</p>
                        </div>
                        <div className="w-10 h-5 bg-neutral-200 rounded-full relative">
                          <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-bold">Suspicion Alerts</p>
                          <p className="text-xs text-neutral-500">Highlight potentially fraudulent listings</p>
                        </div>
                        <div className="w-10 h-5 bg-neutral-900 rounded-full relative">
                          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
