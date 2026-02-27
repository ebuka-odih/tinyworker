import React from 'react'
import { ArrowRight, ChevronRight, Trash2 } from 'lucide-react'

import { Card } from '../AppPrimitives'

export function SettingsView({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="p-4 space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500">Preferences & Account</p>
      </header>

      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Profile & Preferences</h3>
          <Card className="divide-y divide-slate-50 p-0 overflow-hidden">
            <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-left">
              <div>
                <div className="font-bold text-slate-800">Target Countries</div>
                <div className="text-xs text-slate-500">Germany, Switzerland, UK</div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
            <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 text-left">
              <div>
                <div className="font-bold text-slate-800">Preferred Roles</div>
                <div className="text-xs text-slate-500">Frontend, Fullstack, Product</div>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          </Card>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Privacy & AI Consent</h3>
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Assisted Apply</div>
                <div className="text-xs text-slate-500">Allow AI to help fill forms</div>
              </div>
              <div className="w-12 h-6 bg-slate-900 rounded-full relative">
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-800">Full Auto-Apply</div>
                <div className="text-xs text-slate-500">Pro feature • Requires strict consent</div>
              </div>
              <div className="w-12 h-6 bg-slate-200 rounded-full relative">
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
              </div>
            </div>
          </Card>
        </section>

        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Account</h3>
          <Card className="p-0 overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 text-slate-700 font-bold hover:bg-slate-50 border-b border-slate-100"
              onClick={onSignOut}
            >
              <ArrowRight size={18} />
              <span>Sign Out</span>
            </button>
            <button className="w-full flex items-center gap-3 p-4 text-rose-600 font-bold hover:bg-rose-50">
              <Trash2 size={18} />
              <span>Delete Account</span>
            </button>
          </Card>
        </section>
      </div>
    </div>
  )
}
