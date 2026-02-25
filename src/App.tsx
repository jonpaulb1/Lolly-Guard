/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  ShieldAlert, 
  Search, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Download, 
  History,
  Scale,
  Gavel,
  Loader2,
  ChevronRight,
  Highlighter,
  LayoutDashboard,
  Plus,
  Users,
  BarChart3,
  FileUp,
  Trash2,
  ExternalLink,
  Zap,
  Type as TypeIcon,
  PenTool,
  Image as ImageIcon,
  BookOpen,
  Sparkles,
  MessageSquare,
  Palmtree,
  Sun,
  Waves
} from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'checker' | 'plagiarism' | 'humanizer' | 'paraphraser' | 'grammar' | 'image-gen' | 'dashboard' | 'report';

interface Submission {
  id: string;
  student_name: string;
  submission_text: string;
  overall_probability: number;
  confidence_score: number;
  verdict: string;
  analysis_summary: string;
  created_at: string;
  flagged_passages?: { text: string; reason: string; probability: number }[];
}

export default function App() {
  const [view, setView] = useState<View>('checker');
  const [text, setText] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('/api/submissions');
      const data = await res.json();
      setSubmissions(data);
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    }
  };

  const handleAction = async (type: View) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setGeneratedImage(null);

    try {
      if (type === 'image-gen') {
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setGeneratedImage(data.imageUrl);
      } else {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text, 
            studentName, 
            type: type === 'checker' ? 'ai-detector' : type 
          }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResult(data);
        if (type === 'checker' || type === 'plagiarism') {
          fetchSubmissions();
        }
      }
      
      resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Operation failed. Please check your API configuration.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleViewReport = async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/${id}`);
      const data = await res.json();
      setSelectedSubmission(data);
      setView('report');
    } catch (err) {
      console.error('Failed to fetch report:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setBulkFiles(Array.from(e.target.files));
    }
  };

  const processBulk = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      for (const file of bulkFiles) {
        const content = await file.text();
        await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: content, 
            studentName: file.name, 
            type: 'ai-detector' 
          }),
        });
      }
      setBulkFiles([]);
      fetchSubmissions();
      setView('dashboard');
    } catch (err: any) {
      setError('Bulk processing failed at some point.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score > 70) return 'bg-rose-50 border-rose-200 text-rose-700';
    if (score > 30) return 'bg-amber-50 border-amber-200 text-amber-700';
    return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  };

  const tools = [
    { id: 'checker', name: 'AI Detector', icon: ShieldAlert, color: 'text-lali-sunset' },
    { id: 'plagiarism', name: 'Plagiarism', icon: Search, color: 'text-lali-ocean' },
    { id: 'humanizer', name: 'Humanizer', icon: Sparkles, color: 'text-lali-gold' },
    { id: 'paraphraser', name: 'Paraphraser', icon: PenTool, color: 'text-lali-palm' },
    { id: 'grammar', name: 'Grammar', icon: TypeIcon, color: 'text-blue-500' },
    { id: 'image-gen', name: 'Image Gen', icon: ImageIcon, color: 'text-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-lali-sand/30 text-[#1A1A1A] font-sans selection:bg-lali-ocean/20 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen shadow-xl z-20">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-br from-lali-palm/5 to-transparent">
          <div className="bg-lali-palm p-2 rounded-xl shadow-lg shadow-lali-palm/20">
            <Palmtree className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tighter text-lali-palm block leading-none">Lolly</span>
            <span className="text-[10px] font-bold text-lali-sunset uppercase tracking-[0.2em]">Guard</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
            <Sun className="w-3 h-3 text-lali-gold" /> LALI Tools
          </div>
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setView(tool.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all group",
                view === tool.id 
                  ? "bg-lali-palm text-white shadow-lg shadow-lali-palm/20" 
                  : "text-gray-500 hover:bg-lali-sand/50 hover:text-lali-palm"
              )}
            >
              <tool.icon className={cn("w-5 h-5 transition-colors", view === tool.id ? "text-lali-gold" : "text-gray-400 group-hover:text-lali-palm")} />
              {tool.name}
            </button>
          ))}
          
          <div className="pt-8 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-2 flex items-center gap-2">
            <Waves className="w-3 h-3 text-lali-ocean" /> Admin
          </div>
          <button
            onClick={() => setView('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
              view === 'dashboard' 
                ? "bg-gray-900 text-white shadow-lg" 
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-lali-sand/50 rounded-2xl p-4 flex items-center gap-3 border border-lali-palm/5">
            <div className="w-10 h-10 rounded-full bg-lali-palm flex items-center justify-center text-white font-black shadow-inner">LA</div>
            <div>
              <div className="text-xs font-black text-lali-palm">LALI Admin</div>
              <div className="text-[10px] text-lali-palm/60 font-bold">LA Law Institute</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto relative">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-lali-gold/5 blur-3xl rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-lali-ocean/5 blur-3xl rounded-full -ml-48 -mb-48" />

        <div className="max-w-5xl mx-auto px-8 py-12 relative z-10">
          {view !== 'dashboard' && view !== 'report' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <header className="mb-12 flex items-end justify-between">
                <div>
                  <div className="flex items-center gap-2 text-lali-palm font-black text-xs uppercase tracking-widest mb-2">
                    <Sun className="w-4 h-4 text-lali-gold" /> LA Law Institute
                  </div>
                  <h1 className="text-5xl font-black text-gray-900 tracking-tighter">
                    {tools.find(t => t.id === view)?.name}
                  </h1>
                </div>
                <div className="hidden md:block text-right">
                  <div className="text-3xl font-black text-lali-palm/10 tracking-tighter leading-none">LOLLY</div>
                  <div className="text-xs font-bold text-lali-sunset tracking-[0.3em]">GUARD</div>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  {view === 'image-gen' ? (
                    <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                      <div className="p-5 border-b border-gray-50 bg-gradient-to-r from-purple-50/50 to-transparent flex items-center gap-2 text-sm font-bold text-gray-700">
                        <ImageIcon className="w-5 h-5 text-purple-500" />
                        Creative Prompt
                      </div>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the image you want to generate..."
                        className="w-full h-[200px] p-8 focus:outline-none resize-none text-gray-800 leading-relaxed text-lg"
                      />
                      <div className="p-5 bg-gray-50/50 border-t border-gray-50 flex justify-end">
                        <button 
                          onClick={() => handleAction('image-gen')} 
                          disabled={isAnalyzing || !prompt.trim()} 
                          className="bg-purple-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-purple-200 hover:bg-purple-700 hover:-translate-y-0.5 transition-all disabled:bg-gray-200 disabled:shadow-none"
                        >
                          {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Generate"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                      <div className="p-5 border-b border-gray-50 bg-gray-50/30 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Users className="w-5 h-5 text-lali-palm" />
                          <input 
                            type="text" 
                            placeholder="Student Name / Case Reference"
                            value={studentName}
                            onChange={(e) => setStudentName(e.target.value)}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold text-gray-700 w-full"
                          />
                        </div>
                        {view === 'checker' && (
                          <label className="cursor-pointer flex items-center gap-2 text-xs font-black text-lali-palm hover:text-lali-sunset transition-colors">
                            <FileUp className="w-5 h-5" />
                            BULK
                            <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                          </label>
                        )}
                      </div>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste text here for LALI forensic analysis..."
                        className="w-full h-[400px] p-8 focus:outline-none resize-none text-gray-800 leading-relaxed text-lg font-serif"
                      />
                      <div className="p-5 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
                        <div className="flex gap-2">
                          {bulkFiles.length > 0 && (
                            <span className="text-xs font-black text-white bg-lali-palm px-4 py-1.5 rounded-full shadow-lg shadow-lali-palm/20">
                              {bulkFiles.length} FILES
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3">
                          {bulkFiles.length > 0 ? (
                            <button onClick={processBulk} className="bg-lali-palm text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-lali-palm/20 hover:bg-lali-palm/90 hover:-translate-y-0.5 transition-all">
                              PROCESS ALL
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleAction(view)} 
                              disabled={isAnalyzing || !text.trim()} 
                              className={cn(
                                "text-white px-10 py-4 rounded-2xl font-black shadow-xl transition-all hover:-translate-y-0.5",
                                tools.find(t => t.id === view)?.color.replace('text-', 'bg-'),
                                "disabled:bg-gray-200 disabled:shadow-none disabled:translate-y-0"
                              )}
                            >
                              {isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : `RUN ${tools.find(t => t.id === view)?.name.toUpperCase()}`}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-4 text-rose-700 text-sm font-bold shadow-sm">
                      <AlertTriangle className="w-6 h-6 shrink-0" />
                      {error}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4" ref={resultsRef}>
                  <AnimatePresence mode="wait">
                    {isAnalyzing ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full bg-white rounded-3xl border border-gray-100 p-10 flex flex-col items-center justify-center text-center shadow-xl shadow-gray-100">
                        <div className="relative mb-6">
                          <Loader2 className="w-16 h-16 text-lali-palm animate-spin" />
                          <Palmtree className="w-6 h-6 text-lali-gold absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-lg font-black text-lali-palm tracking-tight">LALI Analysis in Progress</p>
                        <p className="text-xs text-gray-400 font-bold mt-2">Consulting forensic models...</p>
                      </motion.div>
                    ) : result ? (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
                        {view === 'checker' && (
                          <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-2xl shadow-gray-200/50 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-lali-sunset via-lali-gold to-lali-ocean" />
                            <div className="text-6xl font-black text-gray-900 mb-2 tracking-tighter">{result.overallProbability}%</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">AI PROBABILITY</div>
                            <div className={cn("p-5 rounded-2xl border-2 font-black text-xl mb-8 shadow-sm", getScoreColor(result.overallProbability))}>
                              {result.verdict.toUpperCase()}
                            </div>
                            <button onClick={() => setView('dashboard')} className="w-full bg-lali-palm text-white py-4 rounded-2xl font-black hover:bg-lali-palm/90 transition-all shadow-xl shadow-lali-palm/20">
                              VIEW DASHBOARD
                            </button>
                          </div>
                        )}

                        {view === 'plagiarism' && (
                          <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-2xl shadow-gray-200/50">
                            <div className="text-center mb-10">
                              <div className="text-6xl font-black text-gray-900 mb-2 tracking-tighter">{result.plagiarismScore}%</div>
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">SIMILARITY</div>
                            </div>
                            <div className="space-y-4">
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Waves className="w-3 h-3 text-lali-ocean" /> TOP SOURCES
                              </div>
                              {result.sourcesFound?.map((s: any, i: number) => (
                                <div key={i} className="p-4 bg-lali-sand/30 rounded-2xl border border-lali-palm/5 hover:border-lali-ocean/30 transition-colors">
                                  <div className="flex justify-between text-xs font-black mb-2">
                                    <span className="truncate w-32 text-lali-palm">{s.source}</span>
                                    <span className="text-lali-sunset">{s.matchPercentage}%</span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 line-clamp-2 italic font-serif">"{s.snippet}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(view === 'humanizer' || view === 'paraphraser') && (
                          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-2xl shadow-gray-200/50 space-y-6">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LALI OUTPUT</div>
                            <div className="p-6 bg-lali-sand/20 rounded-2xl border border-lali-palm/5 text-sm text-gray-800 leading-relaxed font-serif italic relative">
                              <Sparkles className="w-4 h-4 text-lali-gold absolute -top-2 -right-2" />
                              {result.humanizedText || result.paraphrasedText}
                            </div>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(result.humanizedText || result.paraphrasedText);
                                alert("Copied to clipboard!");
                              }}
                              className="w-full flex items-center justify-center gap-3 text-xs font-black text-lali-palm hover:bg-lali-sand/50 py-4 rounded-2xl border-2 border-lali-palm/10 transition-all"
                            >
                              <Download className="w-5 h-5" /> COPY RESULT
                            </button>
                          </div>
                        )}

                        {view === 'grammar' && (
                          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-2xl shadow-gray-200/50 space-y-6">
                            <div className="flex justify-between items-center">
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">GRAMMAR REPORT</div>
                              <span className="bg-lali-sunset/10 text-lali-sunset px-3 py-1 rounded-full text-[10px] font-black">{result.errorCount} ISSUES</span>
                            </div>
                            <div className="space-y-4">
                              {result.suggestions?.map((s: any, i: number) => (
                                <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="line-through text-gray-400 font-medium">{s.original}</span>
                                    <ChevronRight className="w-4 h-4 text-lali-ocean" />
                                    <span className="text-lali-palm font-black">{s.suggestion}</span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 font-bold">{s.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : generatedImage ? (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-2xl shadow-gray-200/50">
                        <div className="relative group">
                          <img src={generatedImage} alt="Generated" className="w-full rounded-2xl mb-6 shadow-inner" />
                          <div className="absolute inset-0 bg-lali-palm/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                            <ImageIcon className="w-12 h-12 text-white" />
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = generatedImage;
                            link.download = 'lali-generated.png';
                            link.click();
                          }}
                          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black hover:bg-gray-800 transition-all flex items-center justify-center gap-3 shadow-xl"
                        >
                          <Download className="w-5 h-5" /> DOWNLOAD
                        </button>
                      </motion.div>
                    ) : (
                      <div className="h-full bg-lali-sand/20 rounded-3xl border-2 border-dashed border-lali-palm/10 flex flex-col items-center justify-center p-10 text-center text-lali-palm/30">
                        <Palmtree className="w-16 h-16 mb-6 opacity-20" />
                        <p className="text-sm font-black uppercase tracking-widest">LALI Forensic Suite</p>
                        <p className="text-[10px] font-bold mt-2">Awaiting input...</p>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {/* Dashboard View */}
          {view === 'dashboard' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-black text-gray-900 tracking-tighter">LALI Dashboard</h1>
                  <p className="text-gray-500 font-bold">Institutional integrity overview.</p>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100 flex items-center gap-5">
                    <div className="bg-lali-palm/10 p-4 rounded-2xl"><FileText className="w-8 h-8 text-lali-palm" /></div>
                    <div>
                      <div className="text-3xl font-black text-gray-900 leading-none">{submissions.length}</div>
                      <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Total Cases</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50/50 border-b border-gray-100">
                    <tr>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Student / Case</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Probability</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Verdict</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                      <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-lali-sand/10 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="font-black text-gray-900">{sub.student_name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">LALI-REF: {sub.id.toUpperCase()}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                              <div className={cn("h-full transition-all duration-1000", sub.overall_probability > 70 ? "bg-lali-sunset" : "bg-lali-ocean")} style={{ width: `${sub.overall_probability}%` }} />
                            </div>
                            <span className="text-sm font-black text-gray-700">{sub.overall_probability}%</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={cn("text-[10px] font-black uppercase px-3 py-1.5 rounded-full shadow-sm", getScoreColor(sub.overall_probability))}>
                            {sub.verdict}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-sm font-bold text-gray-500">
                          {new Date(sub.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button onClick={() => handleViewReport(sub.id)} className="text-lali-palm hover:text-lali-sunset font-black text-xs flex items-center gap-2 ml-auto transition-colors">
                            VIEW REPORT <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {view === 'report' && selectedSubmission && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
              <div className="flex items-center gap-6 mb-12">
                <button onClick={() => setView('dashboard')} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm border border-gray-100">
                  <ChevronRight className="w-6 h-6 rotate-180 text-lali-palm" />
                </button>
                <div>
                  <div className="text-[10px] font-black text-lali-sunset uppercase tracking-[0.3em] mb-1">Forensic Report</div>
                  <h1 className="text-4xl font-black text-gray-900 tracking-tighter">{selectedSubmission.student_name}</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-2xl shadow-gray-200/50 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-lali-sunset via-lali-gold to-lali-ocean" />
                    <div className="text-7xl font-black text-gray-900 mb-2 tracking-tighter">{selectedSubmission.overall_probability}%</div>
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">AI PROBABILITY</div>
                    <div className={cn("p-5 rounded-2xl border-2 font-black text-xl shadow-sm", getScoreColor(selectedSubmission.overall_probability))}>
                      {selectedSubmission.verdict.toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl shadow-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <History className="w-4 h-4 text-lali-palm" /> LALI SUMMARY
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed italic font-serif">"{selectedSubmission.analysis_summary}"</p>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100 overflow-hidden">
                    <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex items-center justify-between">
                      <h3 className="font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <ShieldAlert className="w-6 h-6 text-lali-sunset" /> FLAGGED PASSAGES
                      </h3>
                      <span className="bg-lali-sunset text-white px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-lali-sunset/20">
                        {selectedSubmission.flagged_passages?.length || 0} INSTANCES
                      </span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {selectedSubmission.flagged_passages?.map((p, i) => (
                        <div key={i} className="p-8 space-y-4 hover:bg-lali-sand/5 transition-colors">
                          <p className="text-gray-800 font-serif text-lg leading-relaxed bg-lali-sunset/5 p-6 rounded-2xl border border-lali-sunset/10 italic">"{p.text}"</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs font-black text-lali-sunset uppercase tracking-widest">
                              <AlertTriangle className="w-5 h-5" /> {p.reason}
                            </div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.probability}% MATCH</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
