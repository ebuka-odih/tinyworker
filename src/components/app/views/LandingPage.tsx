import React, { useState } from 'react'
import { Briefcase, CheckCircle2, FileText, Menu, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'

import { Badge, Button, Card } from '../AppPrimitives'

export function LandingPage({
  onSignIn,
  onStartChat,
  onUploadCv,
}: {
  onSignIn: () => void
  onStartChat: () => void
  onUploadCv: () => void
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-slate-900">
            <Sparkles className="fill-slate-900" />
            <span>Opportunity Agent</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
            <a href="#pricing" className="hover:text-slate-900">Pricing</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
            <Button variant="outline" onClick={onSignIn}>Sign in</Button>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu />
          </button>
        </div>
      </header>

      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6"
          >
            Find scholarships, jobs, and visa requirements - <span className="text-slate-500">apply smarter.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto"
          >
            Upload your CV, discover opportunities, tailor documents automatically, and track everything in one place.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button className="w-full sm:w-auto px-8 py-4 text-lg" onClick={onStartChat}>
              Start in Chat
            </Button>
            <Button variant="outline" className="w-full sm:w-auto px-8 py-4 text-lg" onClick={onUploadCv}>
              Upload CV (2 mins)
            </Button>
          </motion.div>

          <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-slate-500 font-medium">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Official links only</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Document tailoring</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Monitoring alerts</div>
            <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-500" /> Consent-based auto-apply</div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-50 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12">
          <Card className="overflow-hidden border-slate-200 bg-slate-50/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl">Chat Preview</h3>
              <Badge>Agent-Led</Badge>
            </div>
            <div className="space-y-4">
              <div className="bg-white p-3 rounded-xl rounded-bl-none shadow-sm max-w-[80%] border border-slate-100">
                Hi! I'm your Opportunity Agent. What are we looking for today?
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="bg-white">Scholarships</Button>
                <Button variant="outline" className="bg-white">Jobs</Button>
                <Button variant="outline" className="bg-white">Visa Info</Button>
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden border-emerald-100 bg-emerald-50/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl">Dashboard Preview</h3>
              <Badge color="emerald">Live Tracking</Badge>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="font-semibold">Master CV v2</div>
                    <div className="text-xs text-slate-500">Health Score: 85/100</div>
                  </div>
                </div>
                <Badge color="emerald">Ready</Badge>
              </div>
              <div className="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-amber-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                    <Briefcase size={20} />
                  </div>
                  <div>
                    <div className="font-semibold">Software Engineer</div>
                    <div className="text-xs text-slate-500">Google • Zurich</div>
                  </div>
                </div>
                <Badge color="amber">Tailoring</Badge>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  )
}
