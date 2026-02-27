import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { 
  Home, 
  MessageSquare, 
  LayoutDashboard, 
  FileText, 
  Briefcase, 
  Settings, 
  Bell,
  Search,
  Upload,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Menu,
  X,
  Plus,
  Download,
  ExternalLink,
  Trash2,
  Edit3,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, CVData, Opportunity, Application, ChatMessage, Document } from './types';
import { tinyfishService } from './services/tinyfishService';

// shadcn/ui
import { Button as ShadButton } from '../components/ui/button'
import { Card as ShadCard, CardContent as ShadCardContent } from '../components/ui/card'
import { Badge as ShadBadge } from '../components/ui/badge'

// --- Components ---

  const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  icon: Icon,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
  icon?: any
  key?: React.Key
}) => {
  const mapVariant = (v: string): any => {
    switch (v) {
      case 'primary':
        return 'default'
      case 'secondary':
        return 'default'
      case 'outline':
        return 'outline'
      case 'ghost':
        return 'ghost'
      case 'danger':
        return 'destructive'
      default:
        return 'default'
    }
  }

  return (
    <ShadButton
      variant={mapVariant(variant)}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {Icon && <Icon size={18} />}
      {children}
    </ShadButton>
  )
}

const Card = ({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
  key?: React.Key
}) => (
  <ShadCard id={id} className={className}>
    <ShadCardContent className="p-5">{children}</ShadCardContent>
  </ShadCard>
)

const Badge = ({
  children,
  color = 'slate',
}: {
  children: React.ReactNode
  color?: string
}) => {
  // map old color scheme to shadcn variants
  const variant = ((): any => {
    if (color === 'indigo') return 'default'
    if (color === 'emerald') return 'secondary'
    if (color === 'amber') return 'secondary'
    if (color === 'rose') return 'destructive'
    return 'outline'
  })()

  return <ShadBadge variant={variant}>{children}</ShadBadge>
}

// --- Main App ---

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()

  const routeToTab = (pathname: string) => {
    if (pathname.startsWith('/chat')) return 'chat'
    if (pathname.startsWith('/documents')) return 'documents'
    if (pathname.startsWith('/applications')) return 'applications'
    if (pathname.startsWith('/settings')) return 'settings'
    if (pathname.startsWith('/dashboard')) return 'dashboard'
    if (pathname === '/' || pathname.startsWith('/home')) return 'home'
    return 'dashboard'
  }

  const tabToRoute: Record<string, string> = {
    home: '/',
    dashboard: '/dashboard',
    chat: '/chat',
    documents: '/documents',
    applications: '/applications',
    settings: '/settings',
  }

  const [activeTab, setActiveTab] = useState(routeToTab(location.pathname));
  const [user, setUser] = useState<UserProfile>({});
  const [cvs, setCvs] = useState<CVData[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: 'doc1',
      type: 'cv',
      title: 'Master CV v2',
      content: 'Initial master CV content...',
      createdAt: new Date('2026-02-24').toISOString(),
    },
    {
      id: 'doc2',
      type: 'cover_letter',
      title: 'Zalando Cover Letter',
      content: 'Dear Zalando Team...',
      createdAt: new Date('2026-02-25').toISOString(),
    }
  ]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  // Keep tab state in sync with URL.
  useEffect(() => {
    const next = routeToTab(location.pathname)
    if (next !== activeTab) setActiveTab(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const cvFileInputRef = React.useRef<HTMLInputElement>(null);

  const loadCvs = async () => {
    try {
      const res = await fetch('api/cv');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.cvs)) {
        // map server records → CVData minimal
        const mapped: CVData[] = data.cvs.map((c: any) => ({
          id: String(c.id),
          name: String(c.filename || 'CV'),
          version: 1,
          content: '',
          createdAt: String(c.uploadedAt || new Date().toISOString()),
        }));
        setCvs(mapped);
      }
    } catch {
      // ignore
    }
  };

  const uploadCv = async (file: File) => {
    setCvError(null);
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('api/cv/upload', { method: 'POST', body: fd });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Upload failed');
      }
      await loadCvs();
    } catch (e: any) {
      setCvError(e?.message || 'Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCvs();
  }, []);

  // --- Views ---

  const LandingPage = () => (
    <div className="min-h-screen bg-white">
      {/* Header */}
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
            <Button variant="outline" onClick={() => setActiveTab('dashboard')}>Sign in</Button>
          </div>
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6"
          >
            Find scholarships, jobs, and visa requirements — <span className="text-slate-500">apply smarter.</span>
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
            <Button className="w-full sm:w-auto px-8 py-4 text-lg" onClick={() => setActiveTab('chat')}>
              Start in Chat
            </Button>
            <Button variant="outline" className="w-full sm:w-auto px-8 py-4 text-lg" onClick={() => setActiveTab('dashboard')}>
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

      {/* Preview Section */}
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
  );

  const ChatView = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
      { role: 'assistant', content: "Hi! I'm your Opportunity Agent. I can help you find scholarships, jobs, or visa requirements. What's our goal today?", type: 'options', options: ['Scholarships', 'Jobs', 'Visa Requirements', 'Upload CV'] }
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    }

    useEffect(() => {
      scrollToBottom()
    }, [messages, isTyping]);

    const handleOption = async (option: string) => {
      const userMsg: ChatMessage = { role: 'user', content: option };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      // Simulate agent logic
      setTimeout(async () => {
        if (option === 'Scholarships') {
          setMessages(prev => [...prev, { role: 'assistant', content: "Excellent choice. Scholarships can be life-changing. To give you the best matches, which country are you targeting for your studies?", type: 'options', options: ['USA', 'UK', 'Germany', 'Canada', 'Other'] }]);
        } else if (option === 'Jobs') {
          setMessages(prev => [...prev, { role: 'assistant', content: "I'll help you find the perfect role. I'll cross-reference your CV with live listings. What's your primary field of expertise?", type: 'options', options: ['Software Engineering', 'Data Science', 'Marketing', 'Design', 'Other'] }]);
        } else if (['USA', 'UK', 'Germany', 'Canada'].includes(option)) {
          setMessages(prev => [...prev, { role: 'assistant', content: `Understood. I'm now connecting to the official education databases in ${option} and filtering for high-value scholarships matching your profile...`, type: 'progress' }]);
          
          setTimeout(async () => {
            setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, content: `Found 12 potential matches. Analyzing eligibility criteria for each...` } : m));
            
            setTimeout(async () => {
              // Scholarships search is coming soon (TinyFish integration will be added after jobs MVP)
              const results: Opportunity[] = []
              setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `Scholarship search is coming next. For now, Jobs search is enabled.`, type: 'results', results }]);
              setIsTyping(false);
            }, 1500);
          }, 1500);
          return;
        } else if (option === 'Software Engineering') {
          setMessages(prev => [...prev, { role: 'assistant', content: `Great. I'm scanning top-tier tech hubs and companies offering visa sponsorship for Software Engineers...`, type: 'progress' }]);
          
          setTimeout(async () => {
            const results = await tinyfishService.searchJobsLinkedIn('Software Engineering visa sponsorship')
            setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `Here are roles I found on LinkedIn (public search):`, type: 'results', results }]);
            setIsTyping(false);
          }, 2000);
          return;
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: "I'm processing your request. Let's head to your dashboard to see the full analysis and tailored recommendations.", type: 'options', options: ['Go to Dashboard'] }]);
        }
        setIsTyping(false);
      }, 1000);
    };

    const handleSend = () => {
      if (!inputValue.trim()) return;
      const val = inputValue;
      setInputValue('');
      handleOption(val);
    };

    return (
      <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
        {/* Chat Header - Fixed at top */}
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

        {/* Messages Area - Scrollable */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 pb-[180px] md:pb-44 scroll-smooth"
        >
          {messages.map((msg, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] space-y-3`}>
                <div className={`p-4 rounded-2xl shadow-sm leading-relaxed text-sm ${
                  msg.role === 'user' 
                    ? 'bg-slate-900 text-white rounded-br-none font-medium' 
                    : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'
                }`}>
                  {msg.content}
                </div>
                
                {msg.type === 'options' && (
                  <div className="flex flex-wrap gap-2">
                    {msg.options?.map(opt => (
                      <Button key={opt} variant="outline" className="bg-white border-slate-200 hover:border-slate-900 hover:text-slate-900 shadow-sm py-2.5 px-5" onClick={() => handleOption(opt)}>
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}

                {msg.type === 'results' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {msg.results?.map(res => (
                      <Card key={res.id} className="p-4 border-slate-200 hover:border-slate-400 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                          <Badge color="slate">{res.type.toUpperCase()}</Badge>
                          {res.matchScore && <span className="text-[10px] font-bold text-slate-900">{res.matchScore}% Match</span>}
                        </div>
                        <div className="font-bold text-slate-900 group-hover:text-slate-600 transition-colors">{res.title}</div>
                        <div className="text-xs text-slate-500 mb-2">{res.organization} • {res.location}</div>
                        <div className="text-[11px] text-slate-600 line-clamp-2 mb-3 leading-relaxed">{res.description}</div>
                        <Button variant="ghost" className="w-full text-[10px] py-1 bg-slate-50 hover:bg-slate-100" onClick={() => setActiveTab('dashboard')}>View Details</Button>
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

        {/* Input Area - Sticky at bottom */}
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
            <Button 
              variant="primary" 
              className="px-4 rounded-xl py-2"
              onClick={handleSend}
              disabled={!inputValue.trim()}
            >
              <ArrowRight size={20} />
            </Button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-1 md:mt-2 font-medium">
            Click options above or type to search
          </p>
        </div>
      </div>
    );
  };

  const DashboardView = () => {
    const [isRevampModalOpen, setIsRevampModalOpen] = useState(false);
    const [isJobDetailOpen, setIsJobDetailOpen] = useState(false);
    const [selectedJob, setSelectedJob] = useState<any>(null);
    const [targetRole, setTargetRole] = useState('');
    const [targetTone, setTargetTone] = useState('Professional');
    const [isRevamping, setIsRevamping] = useState(false);
    const [revampResult, setRevampResult] = useState<string | null>(null);

    const handleRevamp = async () => {
      if (!targetRole) return;
      setIsRevamping(true);
      try {
        const masterCV = cvs[0]?.content || '';
        // Resume revamp will be implemented after jobs search MVP.
        // For now, keep a simple placeholder so the UI works end-to-end.
        setRevampResult(`(Coming soon) Resume revamp for: ${targetRole} (${targetTone})\n\nWe will rewrite your CV to match selected jobs using extracted keywords.`);
      } catch (error) {
        console.error('Revamp failed:', error);
      } finally {
        setIsRevamping(false);
      }
    };

    const saveRevampedCV = () => {
      if (!revampResult) return;
      const newDoc: Document = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'cv',
        title: `Revamped CV - ${targetRole}`,
        content: revampResult,
        createdAt: new Date().toISOString(),
      };
      setDocuments(prev => [newDoc, ...prev]);
      setRevampResult(null);
      setIsRevampModalOpen(false);
      setTargetRole('');
    };

    return (
      <div className="p-4 space-y-6 pb-24">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
            <p className="text-sm text-slate-500">Welcome back, Emma</p>
          </div>
          <button className="relative p-2 bg-white border border-slate-200 rounded-xl text-slate-600">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
          </button>
        </header>

        {/* Goal Summary */}
        <Card className="bg-slate-900 text-white border-none shadow-xl shadow-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Current Goal</div>
              <div className="text-lg font-bold">Software Engineer in Germany</div>
            </div>
            <Button variant="ghost" className="text-white hover:bg-white/10 p-1">
              <Edit3 size={16} />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-xl p-3 border border-white/5">
              <div className="text-slate-400 text-[10px] uppercase font-bold">CV Score</div>
              <div className="text-xl font-bold">85/100</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/5">
              <div className="text-slate-400 text-[10px] uppercase font-bold">Matches</div>
              <div className="text-xl font-bold">12 New</div>
            </div>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => cvFileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-400 transition-colors group"
          >
            <div className="w-10 h-10 bg-slate-100 text-slate-900 rounded-full flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <Upload size={20} />
            </div>
            <span className="text-xs font-bold text-slate-700">{isLoading ? 'Uploading…' : 'Upload CV'}</span>
          </button>
          <input
            ref={cvFileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCv(f);
              e.currentTarget.value = '';
            }}
          />
          <button className="flex flex-col items-center justify-center gap-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors group">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Search size={20} />
            </div>
            <span className="text-xs font-bold text-slate-700">Find Jobs</span>
          </button>
        </div>

        {cvError ? (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            {cvError}
          </div>
        ) : null}

        {/* Main Sections */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800">CV & Profile</h3>
            <button className="text-slate-900 text-xs font-bold hover:underline">Manage</button>
          </div>
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                <FileText size={24} />
              </div>
              <div className="flex-1">
                <div className="font-bold text-slate-800 truncate max-w-[220px] sm:max-w-[420px]">{cvs[0]?.name || 'No CV uploaded yet'}</div>
                <div className="text-xs text-slate-500 truncate max-w-[220px] sm:max-w-[420px]">
                  {cvs[0]?.createdAt ? `Uploaded ${new Date(cvs[0].createdAt).toLocaleString()}` : 'Upload a PDF or DOCX to begin'}
                </div>
              </div>
              <Badge color={cvs.length ? 'emerald' : 'slate'}>{cvs.length ? 'On file' : 'Missing'}</Badge>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
              <Button
                variant="primary"
                className="flex-1 text-xs py-2 shadow-lg shadow-slate-200"
                icon={Search}
                disabled={!cvs.length || isLoading}
                onClick={() => {
                  // Next step after upload: guided job search
                  setActiveTab('chat')
                }}
              >
                {cvs.length ? 'Continue → Find Jobs' : 'Upload CV to continue'}
              </Button>
            </div>
          </Card>

          <div className="flex items-center justify-between pt-4">
            <h3 className="font-bold text-slate-800">Matched Opportunities</h3>
            <button className="text-slate-900 text-xs font-bold hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {[
              { id: 1, title: 'Senior Frontend Engineer', company: 'Zalando', location: 'Berlin, Germany', match: '92%' },
              { id: 2, title: 'Fullstack Developer', company: 'N26', location: 'Berlin, Germany', match: '88%' }
            ].map(job => (
              <Card key={job.id} className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-800">{job.title}</div>
                    <div className="text-sm text-slate-500">{job.company} • {job.location}</div>
                  </div>
                  <Badge color="slate">{job.match} Match</Badge>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="primary" className="flex-1 text-xs py-1.5" onClick={() => { setSelectedJob(job); setIsJobDetailOpen(true); }}>View Details</Button>
                  <Button variant="outline" className="text-xs py-1.5">Save</Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4">
            <h3 className="font-bold text-slate-800">Application Pipeline</h3>
            <button className="text-slate-900 text-xs font-bold hover:underline">Kanban</button>
          </div>
          <Card className="p-4 bg-slate-50 border-dashed border-2 border-slate-200">
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-300 mb-3 shadow-sm">
                <Plus size={24} />
              </div>
              <div className="font-bold text-slate-500">No active applications</div>
              <p className="text-xs text-slate-400 mt-1">Start by tailoring docs for a match</p>
            </div>
          </Card>
        </div>

        {/* Modals */}
        <Modal 
          isOpen={isRevampModalOpen} 
          onClose={() => {
            setIsRevampModalOpen(false);
            setRevampResult(null);
            setIsRevamping(false);
          }} 
          title={revampResult ? "Revamped Document" : "Revamp CV"}
        >
          <div className="space-y-6">
            {!revampResult && !isRevamping && (
              <>
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Current Template</div>
                    <div className="text-xs text-slate-600 line-clamp-4 font-mono bg-white p-3 rounded-lg border border-slate-100">
                      {cvs[0]?.content}
                    </div>
                  </div>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Target Role</span>
                    <input 
                      type="text" 
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none" 
                      placeholder="e.g. Senior Frontend Engineer" 
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-bold text-slate-700">Tone</span>
                    <select 
                      value={targetTone}
                      onChange={(e) => setTargetTone(e.target.value)}
                      className="mt-1 w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none"
                    >
                      <option>Professional</option>
                      <option>Bold & Creative</option>
                      <option>Academic</option>
                    </select>
                  </label>
                </div>
                <Button 
                  className="w-full py-4 text-lg" 
                  disabled={!targetRole}
                  onClick={handleRevamp}
                >
                  Start Revamp
                </Button>
              </>
            )}

            {isRevamping && (
              <div className="space-y-6 py-4">
                <div className="relative p-6 bg-slate-900 rounded-2xl overflow-hidden min-h-[300px] flex flex-col justify-center">
                  {/* Scanning Animation */}
                  <motion.div 
                    initial={{ top: 0 }}
                    animate={{ top: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-slate-400 shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10"
                  />
                  
                  <div className="space-y-3 opacity-40">
                    <div className="h-2 w-3/4 bg-slate-700 rounded" />
                    <div className="h-2 w-1/2 bg-slate-700 rounded" />
                    <div className="h-2 w-5/6 bg-slate-700 rounded" />
                    <div className="h-2 w-2/3 bg-slate-700 rounded" />
                    <div className="h-2 w-3/4 bg-slate-700 rounded" />
                  </div>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 backdrop-blur-[2px]">
                    <div className="w-16 h-16 bg-slate-900 rounded-full border border-white/20 flex items-center justify-center text-white mb-4 shadow-2xl animate-pulse">
                      <Sparkles size={32} />
                    </div>
                    <h4 className="text-white font-bold text-lg mb-2">AI is Revamping...</h4>
                    <p className="text-slate-300 text-xs max-w-[200px]">
                      Optimizing keywords for <span className="font-bold text-white">{targetRole}</span> and adjusting to <span className="font-bold text-white">{targetTone}</span> tone.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                    <span>Analyzing job requirements...</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                    <span>Extracting impact metrics...</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-900 font-bold animate-pulse">
                    <div className="w-1 h-1 bg-slate-900 rounded-full" />
                    <span>Rewriting experience section...</span>
                  </div>
                </div>
              </div>
            )}

            {revampResult && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-[60vh] overflow-y-auto relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-slate-900" />
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Optimization Complete</div>
                        <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ATS Optimized • {targetTone} Tone</div>
                      </div>
                    </div>
                    <Badge color="emerald">+15% Score</Badge>
                  </div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-sm text-slate-800 whitespace-pre-wrap font-serif leading-relaxed selection:bg-slate-100"
                  >
                    {revampResult}
                  </motion.div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setRevampResult(null)}>Edit Criteria</Button>
                  <Button variant="primary" className="flex-1 shadow-lg shadow-slate-200" onClick={saveRevampedCV}>Save & Download PDF</Button>
                </div>
              </motion.div>
            )}
          </div>
        </Modal>

        <Modal 
          isOpen={isJobDetailOpen} 
          onClose={() => setIsJobDetailOpen(false)} 
          title="Job Details"
        >
          {selectedJob && (
            <div className="space-y-6">
              <div>
                <h4 className="text-2xl font-bold text-slate-900">{selectedJob.title}</h4>
                <p className="text-slate-500">{selectedJob.company} • {selectedJob.location}</p>
              </div>
              
              <div className="space-y-3">
                <h5 className="font-bold text-slate-800">Requirements</h5>
                <ul className="space-y-2">
                  <li className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> 5+ years of React experience</li>
                  <li className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Strong TypeScript skills</li>
                  <li className="flex gap-2 text-sm text-slate-600"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Experience with Node.js</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <h5 className="font-bold text-slate-800 mb-2">Tailor Documents</h5>
                <p className="text-xs text-slate-500 mb-4">Generate a custom CV and cover letter for this specific role.</p>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1 text-xs" icon={Sparkles}>Tailor CV</Button>
                  <Button variant="outline" className="flex-1 text-xs">Cover Letter</Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" icon={ExternalLink}>Official Link</Button>
                <Button variant="primary" className="flex-1">Apply Now</Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  };

  const DocumentsView = () => (
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
        {documents.length > 0 ? documents.map((doc, i) => (
          <Card key={doc.id} className="flex items-center gap-4 p-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.type.includes('cv') ? 'bg-slate-900 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <FileText size={20} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800">{doc.title}</div>
              <div className="text-xs text-slate-500">{doc.type.toUpperCase()} • {new Date(doc.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="flex gap-1">
              <button className="p-2 text-slate-400 hover:text-slate-900"><Download size={18} /></button>
              <button 
                className="p-2 text-slate-400 hover:text-rose-600"
                onClick={() => setDocuments(prev => prev.filter(d => d.id !== doc.id))}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </Card>
        )) : (
          <div className="text-center py-10 text-slate-400">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>No documents yet. Try revamping your CV!</p>
          </div>
        )}
      </div>
    </div>
  );

  const ApplicationsView = () => (
    <div className="p-4 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Applications</h2>
          <p className="text-sm text-slate-500">Track your progress</p>
        </div>
        <Button variant="outline" icon={Plus}>Add Manual</Button>
      </header>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {['Saved', 'Preparing', 'Applied', 'Interview'].map(stage => (
          <div key={stage} className="min-w-[200px] space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stage}</span>
              <span className="text-xs font-bold text-slate-400">2</span>
            </div>
            <Card className="p-3 border-l-4 border-l-slate-900">
              <div className="font-bold text-sm">Frontend Lead</div>
              <div className="text-xs text-slate-500">Spotify • Stockholm</div>
              <div className="mt-3 flex items-center justify-between">
                <Badge color="emerald">Docs Ready</Badge>
                <ChevronRight size={14} className="text-slate-400" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );

  const SettingsView = () => (
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
            <button className="w-full flex items-center gap-3 p-4 text-rose-600 font-bold hover:bg-rose-50">
              <Trash2 size={18} />
              <span>Delete Account</span>
            </button>
          </Card>
        </section>
      </div>
    </div>
  );

  // --- Main Layout ---

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 p-6 fixed h-full z-50">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900 mb-10">
          <Sparkles className="fill-slate-900" />
          <span>Opportunity Agent</span>
        </div>
        <nav className="flex-1 space-y-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'chat', label: 'Agent', icon: MessageSquare },
            { id: 'documents', label: 'Documents', icon: FileText },
            { id: 'applications', label: 'Applications', icon: Briefcase },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => navigate(tabToRoute[item.id] || '/dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === item.id ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-bold">EG</div>
            <div>
              <div className="text-sm font-bold text-slate-900">Emma Gab</div>
              <div className="text-xs text-slate-500">Pro Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Spacer for fixed sidebar on desktop */}
      <div className="hidden md:block w-64 shrink-0" />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden h-screen flex flex-col relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className={`flex-1 h-full flex flex-col ${activeTab !== 'chat' ? 'overflow-y-auto' : 'overflow-hidden'}`}
          >
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<Navigate to="/" replace />} />
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/chat" element={<ChatView />} />
              <Route path="/documents" element={<DocumentsView />} />
              <Route path="/applications" element={<ApplicationsView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
          { id: 'chat', icon: MessageSquare, label: 'Agent' },
          { id: 'documents', icon: FileText, label: 'Docs' },
          { id: 'applications', icon: Briefcase, label: 'Apps' },
          { id: 'settings', icon: Settings, label: 'Settings' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => navigate(tabToRoute[item.id] || '/dashboard')}
            className={`flex flex-col items-center gap-1 ${activeTab === item.id ? 'text-slate-900' : 'text-slate-400'}`}
          >
            <item.icon size={22} className={activeTab === item.id ? 'stroke-[2.5px]' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
