import React from 'react'
import { ChevronRight, Plus } from 'lucide-react'

import { Application } from '../../../types'
import { Badge, Button, Card } from '../AppPrimitives'

export function ApplicationsView({
  applications,
  onGoDashboard,
}: {
  applications: Application[]
  onGoDashboard: () => void
}) {
  const stages: Application['status'][] = [
    'saved',
    'preparing',
    'ready',
    'applied',
    'interview',
    'offer',
    'rejected',
  ]
  const grouped = stages.map((status) => ({
    status,
    rows: applications.filter((a) => a.status === status),
  }))

  return (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Applications</h2>
          <p className="text-sm text-slate-500">Track your progress</p>
        </div>
        <Button variant="outline" icon={Plus} onClick={onGoDashboard}>
          Add from Dashboard
        </Button>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {grouped.map((stage) => (
          <div key={stage.status} className="min-w-[240px] space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stage.status}</span>
              <span className="text-xs font-bold text-slate-400">{stage.rows.length}</span>
            </div>
            {stage.rows.length ? (
              stage.rows.map((app) => (
                <Card key={app.id} className="p-3 border-l-4 border-l-slate-900">
                  <div className="font-bold text-sm">{app.opportunity?.title || 'Application'}</div>
                  <div className="text-xs text-slate-500">
                    {app.opportunity?.organization || 'Unknown'} • {app.opportunity?.location || 'Unknown'}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge color="emerald">{app.status}</Badge>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-3 text-xs text-slate-400">No applications in this stage.</Card>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
