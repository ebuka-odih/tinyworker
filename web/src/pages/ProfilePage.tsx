import React from 'react';
import { Bell, Bookmark, ExternalLink, Loader2, LogOut, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import { SavedOpportunity } from '../types';
import { ApiUnauthorizedError } from '../services/apiBase';
import { listSavedOpportunities } from '../services/opportunitiesApi';

export function ProfilePage() {
  const navigate = useNavigate();
  const { accessToken, authUser, signOut } = useAuth();
  const [activeTab, setActiveTab] = React.useState<'saved' | 'settings'>('saved');
  const [savedOpportunities, setSavedOpportunities] = React.useState<SavedOpportunity[]>([]);
  const [savedLoading, setSavedLoading] = React.useState(true);

  const initials = React.useMemo(() => authUser?.email?.slice(0, 2).toUpperCase() || 'TW', [authUser?.email]);
  const handleSignOut = () => {
    signOut();
    navigate('/auth?next=%2Fnew-search', { replace: true });
  };

  React.useEffect(() => {
    let cancelled = false;

    const loadSavedOpportunities = async () => {
      setSavedLoading(true);
      try {
        const opportunities = await listSavedOpportunities(accessToken, 'job');
        if (cancelled) return;
        setSavedOpportunities(opportunities);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiUnauthorizedError) {
          handleSignOut();
          return;
        }
        setSavedOpportunities([]);
      } finally {
        if (!cancelled) {
          setSavedLoading(false);
        }
      }
    };

    void loadSavedOpportunities();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="max-w-4xl mx-auto py-4 md:py-8">
      <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
        <div className="w-full md:w-64 flex flex-col gap-2">
          <div className="p-6 bg-white rounded-2xl border border-neutral-200 shadow-sm mb-2 md:mb-6 text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-neutral-900 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              {initials}
            </div>
            <h2 className="text-xl font-bold">Account</h2>
            <p className="text-sm text-neutral-500 truncate">{authUser?.email || 'Signed-in user'}</p>
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
              <Shield size={20} />
              <span className="text-sm md:text-base">Settings</span>
            </button>
          </div>

          <div className="pt-4 border-t border-neutral-200 mt-4 hidden md:block">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all min-h-[48px]"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>

        <div className="flex-1 w-full space-y-6">
          {activeTab === 'saved' ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Saved Opportunities</h3>
                <span className="text-sm font-medium text-neutral-400">{savedOpportunities.length} saved</span>
              </div>

              {savedLoading ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm flex items-center gap-3 text-neutral-500">
                  <Loader2 size={20} className="animate-spin" />
                  Loading saved opportunities...
                </div>
              ) : savedOpportunities.length === 0 ? (
                <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-100 text-neutral-900 flex items-center justify-center mb-5">
                    <Bookmark size={24} />
                  </div>
                  <h4 className="text-xl font-bold text-neutral-900">No saved opportunities yet</h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-500 max-w-xl">
                    Save jobs from the search session with the bookmark icon and they will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedOpportunities.map((opportunity) => (
                    <div key={opportunity.id} className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="text-lg font-bold text-neutral-900">{opportunity.title}</h4>
                          <p className="mt-1 text-sm text-neutral-500">
                            {opportunity.organization || 'Unknown organization'} • {opportunity.location || 'Unknown location'}
                          </p>
                          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                            {opportunity.source || 'Saved from search'}
                          </p>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-bold uppercase tracking-wider">
                          Saved
                        </span>
                      </div>

                      {opportunity.description && (
                        <p className="mt-4 text-sm leading-6 text-neutral-600">{opportunity.description}</p>
                      )}

                      <div className="mt-5 flex items-center justify-end">
                        {opportunity.link ? (
                          <a
                            href={opportunity.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-black transition-all"
                          >
                            Open listing
                            <ExternalLink size={14} />
                          </a>
                        ) : (
                          <span className="inline-flex items-center rounded-xl bg-neutral-100 px-4 py-2 text-sm font-bold text-neutral-500">
                            Source link unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Account Settings</h3>
                <span className="text-sm font-medium text-neutral-400">Secure session</span>
              </div>

              <div className="space-y-6">
                <section className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={16} />
                    Identity
                  </h4>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Email</p>
                      <p className="mt-2 text-sm font-semibold text-neutral-900 break-all">{authUser?.email}</p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">User ID</p>
                      <p className="mt-2 text-sm font-semibold text-neutral-900 break-all">{authUser?.userId}</p>
                    </div>
                  </div>
                </section>

                <section className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                    <Bell size={16} />
                    Notifications
                  </h4>
                  <div className="mt-5 space-y-4 text-sm text-neutral-500">
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      Email alerts and digests are not wired yet in this web client.
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                      Search auth is active now; notification preferences can be layered on later without changing the login flow.
                    </div>
                  </div>
                </section>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="md:hidden w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl font-bold text-red-500 border border-red-100 hover:bg-red-50 transition-all min-h-[48px]"
                >
                  <LogOut size={20} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
