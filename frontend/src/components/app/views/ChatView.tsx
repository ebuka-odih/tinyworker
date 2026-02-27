import React, { useEffect, useState } from 'react'
import { ArrowRight, Search, Settings, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'

import { ChatMessage, Opportunity } from '../../../types'
import { tinyfishService } from '../../../services/tinyfishService'
import { Badge, Button, Card } from '../AppPrimitives'

export function ChatView({
  onImportOpportunities,
  onViewDetails,
}: {
  onImportOpportunities: (items: Opportunity[]) => Promise<void>
  onViewDetails: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm your Opportunity Agent. I can help you find scholarships, jobs, or visa requirements. What's our goal today?",
      type: 'options',
      options: ['Scholarships', 'Jobs', 'Visa Requirements', 'Upload CV'],
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleOption = async (option: string) => {
    const userMsg: ChatMessage = { role: 'user', content: option }
    setMessages((prev) => [...prev, userMsg])
    setIsTyping(true)

    setTimeout(async () => {
      if (option === 'Scholarships') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Excellent choice. Scholarships can be life-changing. To give you the best matches, which country are you targeting for your studies?',
            type: 'options',
            options: ['USA', 'UK', 'Germany', 'Canada', 'Other'],
          },
        ])
      } else if (option === 'Jobs') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "I'll help you find the perfect role. I'll cross-reference your CV with live listings. What's your primary field of expertise?",
            type: 'options',
            options: ['Software Engineering', 'Data Science', 'Marketing', 'Design', 'Other'],
          },
        ])
      } else if (['USA', 'UK', 'Germany', 'Canada'].includes(option)) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Understood. I'm now connecting to the official education databases in ${option} and filtering for high-value scholarships matching your profile...`,
            type: 'progress',
          },
        ])

        setTimeout(async () => {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: 'Found 12 potential matches. Analyzing eligibility criteria for each...' }
                : m,
            ),
          )

          setTimeout(async () => {
            const results: Opportunity[] = []
            setMessages((prev) => [
              ...prev.slice(0, -1),
              {
                role: 'assistant',
                content: 'Scholarship search is coming next. For now, Jobs search is enabled.',
                type: 'results',
                results,
              },
            ])
            setIsTyping(false)
          }, 1500)
        }, 1500)
        return
      } else if (option === 'Software Engineering') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'Great. I\'m scanning top-tier tech hubs and companies offering visa sponsorship for Software Engineers...',
            type: 'progress',
          },
        ])

        setTimeout(async () => {
          const results = await tinyfishService.searchJobsLinkedIn('Software Engineering visa sponsorship')
          await onImportOpportunities(results)
          setMessages((prev) => [
            ...prev.slice(0, -1),
            {
              role: 'assistant',
              content: 'Here are roles I found on LinkedIn (public search):',
              type: 'results',
              results,
            },
          ])
          setIsTyping(false)
        }, 2000)
        return
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              "I'm processing your request. Let's head to your dashboard to see the full analysis and tailored recommendations.",
            type: 'options',
            options: ['Go to Dashboard'],
          },
        ])
      }
      setIsTyping(false)
    }, 1000)
  }

  const handleSend = () => {
    if (!inputValue.trim()) return
    const val = inputValue
    setInputValue('')
    handleOption(val)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      <div className="shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-lg shadow-slate-200">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Opportunity Agent</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Agent View</span>
              <span className="text-[10px] text-slate-400">• Guided steps + results</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <Search size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-[180px] md:pb-44 scroll-smooth">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className="max-w-[85%] space-y-3">
              <div
                className={`p-4 rounded-2xl shadow-sm leading-relaxed text-sm ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-br-none font-medium'
                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                }`}
              >
                {msg.content}
              </div>

              {msg.type === 'options' && (
                <div className="flex flex-wrap gap-2">
                  {msg.options?.map((opt) => (
                    <Button
                      key={opt}
                      variant="outline"
                      className="bg-white border-slate-200 hover:border-slate-900 hover:text-slate-900 shadow-sm py-2.5 px-5"
                      onClick={() => handleOption(opt)}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              )}

              {msg.type === 'results' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {msg.results?.map((res) => (
                    <Card key={res.id} className="p-4 border-slate-200 hover:border-slate-400 transition-all group">
                      <div className="flex justify-between items-start mb-2">
                        <Badge color="slate">{res.type.toUpperCase()}</Badge>
                        {res.matchScore && (
                          <span className="text-[10px] font-bold text-slate-900">{res.matchScore}% Match</span>
                        )}
                      </div>
                      <div className="font-bold text-slate-900 group-hover:text-slate-600 transition-colors">{res.title}</div>
                      <div className="text-xs text-slate-500 mb-2">{res.organization} • {res.location}</div>
                      <div className="text-[11px] text-slate-600 line-clamp-2 mb-3 leading-relaxed">{res.description}</div>
                      <Button
                        variant="ghost"
                        className="w-full text-[10px] py-1 bg-slate-50 hover:bg-slate-100"
                        onClick={onViewDetails}
                      >
                        View Details
                      </Button>
                    </Card>
                  ))}
                </div>
              )}

              {msg.type === 'progress' && (
                <div className="flex items-center gap-3 p-3 bg-slate-100/50 rounded-xl border border-slate-200/50 text-xs text-slate-700 font-medium">
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  {msg.content}
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1 border border-slate-100">
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 md:p-4 bg-white/90 backdrop-blur-md border-t border-slate-100 z-30 sticky bottom-0 md:bottom-0 bottom-[84px]">
        <div className="max-w-3xl mx-auto flex gap-2 bg-slate-50 p-1 md:p-1.5 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-slate-900/10 focus-within:border-slate-900 transition-all">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent border-none rounded-xl px-3 md:px-4 py-2 focus:outline-none text-sm text-slate-700"
          />
          <Button variant="primary" className="px-4 rounded-xl py-2" onClick={handleSend} disabled={!inputValue.trim()}>
            <ArrowRight size={20} />
          </Button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-1 md:mt-2 font-medium">Click options above or type to search</p>
      </div>
    </div>
  )
}
