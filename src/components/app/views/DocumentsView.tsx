import React from 'react'
import { Download, FileText, Trash2 } from 'lucide-react'

import { Document } from '../../../types'
import { Badge, Card } from '../AppPrimitives'

export function DocumentsView({
  documents,
  onDeleteDocument,
}: {
  documents: Document[]
  onDeleteDocument: (id: string) => Promise<void>
}) {
  return (
    <div className="p-4 space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Documents</h2>
        <p className="text-sm text-slate-500">Manage your CVs and letters</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <Badge color="slate">All Docs</Badge>
        <Badge color="slate">CVs</Badge>
        <Badge color="slate">Cover Letters</Badge>
        <Badge color="slate">Scholarship SOPs</Badge>
      </div>

      <div className="space-y-3">
        {documents.length > 0 ? (
          documents.map((doc) => (
            <Card key={doc.id} className="flex items-center gap-4 p-4">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  doc.type.includes('cv') ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <FileText size={20} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800">{doc.title}</div>
                <div className="text-xs text-slate-500">
                  {doc.type.toUpperCase()} • {new Date(doc.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-1">
                <button className="p-2 text-slate-400 hover:text-slate-900">
                  <Download size={18} />
                </button>
                <button className="p-2 text-slate-400 hover:text-rose-600" onClick={() => onDeleteDocument(doc.id)}>
                  <Trash2 size={18} />
                </button>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-10 text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>No documents yet. Try revamping your CV!</p>
          </div>
        )}
      </div>
    </div>
  )
}
