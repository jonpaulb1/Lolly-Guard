/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, Type } from "@google/genai";
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

type View = 'grader' | 'checker' | 'plagiarism' | 'humanizer' | 'paraphraser' | 'grammar' | 'image-gen' | 'dashboard' | 'report';

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
  const [view, setView] = useState<View>('grader');
  const [text, setText] = useState('');
  const [referenceMaterial, setReferenceMaterial] = useState('');
  const [referenceUrls, setReferenceUrls] = useState('');
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

  const getAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please ensure it is set in the Secrets panel.");
    }
    return new GoogleGenAI({ apiKey });
  };

  const performAnalysis = async (type: string, content: string) => {
    const ai = getAI();
    let systemInstruction = "";
    let responseSchema: any = {};

    if (type === 'grader') {
      systemInstruction = `Bar Exam Essay Grader mode. You are a senior law professor grading a bar exam essay using the IRAC (Issue, Rule, Analysis, Conclusion) method. 
      
      CORE PHILOSOPHY: 
      - Ignore FYLSX (Baby Bar) essay patterns; focus on full Bar Exam standards.
      - Persuasiveness > Correctness: The law often has no single 'correct' answer. Value the most persuasive argument based on the facts provided.
      - Winning Argument: Grade based on whether the student has submitted a potentially winning argument that would convince a judge or jury.
      - Fact-Heavy Analysis: Reward students who 'wring' the facts—using every provided fact to support their legal analysis.
      
      CRITICAL: Recitation of 'Black Letter Law' is REQUIRED and should NOT be penalized. Precise rule statements are a hallmark of a passing essay.
      
      Focus your grading on:
      1. Issue Spotting: Identification of all material legal issues.
      2. Rule Statement: Accuracy and completeness of the Black Letter Law.
      3. Analysis/Application: The depth, logic, and persuasiveness of applying rules to facts. This is the heart of the grade.
      4. Conclusion: While a conclusion is necessary, its 'correctness' is secondary to the quality of the analysis that led to it.
      
      Compare the student's submission against the provided reference material (past exam/model answer). 
      NOTE: If the reference material is an official Bar Model Answer, it represents the 'Gold Standard' for depth and precision.
      Return JSON with overallGrade (e.g., 'High Pass', 'Pass', 'Marginal', 'Fail'), studentFeedback (encouraging, professional, and specific), helpfulHints (specific areas for improvement in analysis or fact-application), modelComparison (how they matched key legal points compared to the model), and potentialScore (0-100).`;
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          overallGrade: { type: Type.STRING },
          studentFeedback: { type: Type.STRING },
          helpfulHints: { type: Type.ARRAY, items: { type: Type.STRING } },
          modelComparison: { type: Type.STRING },
          potentialScore: { type: Type.NUMBER }
        }
      };
    } else if (type === 'checker' || type === 'ai-detector') {
      systemInstruction = "Forensic linguist mode. Analyze for AI generation. Return JSON with overallProbability, confidenceScore, analysisSummary, verdict, flaggedPassages (array of {text, reason, probability}), linguisticMarkers (array of {marker, finding, impact}).";
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          overallProbability: { type: Type.NUMBER },
          confidenceScore: { type: Type.NUMBER },
          analysisSummary: { type: Type.STRING },
          verdict: { type: Type.STRING },
          flaggedPassages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                reason: { type: Type.STRING },
                probability: { type: Type.NUMBER }
              }
            }
          },
          linguisticMarkers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                marker: { type: Type.STRING },
                finding: { type: Type.STRING },
                impact: { type: Type.STRING }
              }
            }
          }
        }
      };
    } else if (type === 'plagiarism') {
      systemInstruction = `Plagiarism detection mode for Legal Essays. 
      CRITICAL RULE: DO NOT count the recitation of 'Black Letter Law' (standard legal rules, statutes, definitions, or case citations) as plagiarism. These are expected to be identical across submissions.
      ONLY flag and score plagiarism for:
      1. Copied analysis or unique arguments.
      2. Copied fact-application phrasing.
      3. Verbatim copying of non-rule text from external sources or the model answer.
      
      Return JSON with plagiarismScore (0-100, where 0 means no non-rule plagiarism), sourcesFound (array of {source, matchPercentage, snippet}), analysisSummary (explaining what was flagged vs what was ignored as standard legal rules).`;
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          plagiarismScore: { type: Type.NUMBER },
          analysisSummary: { type: Type.STRING },
          sourcesFound: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                matchPercentage: { type: Type.NUMBER },
                snippet: { type: Type.STRING }
              }
            }
          }
        }
      };
    } else if (type === 'grammar') {
      systemInstruction = "Grammar and style checker mode. Identify errors and suggest improvements. Return JSON with errorCount, suggestions (array of {original, suggestion, reason, type}), readabilityScore.";
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          errorCount: { type: Type.NUMBER },
          readabilityScore: { type: Type.NUMBER },
          suggestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                suggestion: { type: Type.STRING },
                reason: { type: Type.STRING },
                type: { type: Type.STRING }
              }
            }
          }
        }
      };
    } else if (type === 'paraphraser') {
      systemInstruction = "Paraphrasing tool. Rewrite the text while maintaining legal precision and meaning. Return JSON with paraphrasedText, changesMadeSummary.";
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          paraphrasedText: { type: Type.STRING },
          changesMadeSummary: { type: Type.STRING }
        }
      };
    } else if (type === 'humanizer') {
      systemInstruction = "Text humanizer. Adjust the tone and flow to sound more natural and less robotic while keeping legal accuracy. Return JSON with humanizedText, toneAdjustments.";
      responseSchema = {
        type: Type.OBJECT,
        properties: {
          humanizedText: { type: Type.STRING },
          toneAdjustments: { type: Type.STRING }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Task: ${type}. 
      ${referenceMaterial ? `Reference Material (Past Exam/Model Answer): ${referenceMaterial}` : ''}
      ${referenceUrls ? `Contextual Reference URLs: ${referenceUrls}` : ''}
      Student Submission: ${content}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        tools: referenceUrls ? [{ urlContext: {} }] : undefined
      }
    });

    return JSON.parse(response.text || "{}");
  };

  const handleAction = async (type: View) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setGeneratedImage(null);

    try {
      if (type === 'image-gen') {
        const ai = getAI();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            imageConfig: { aspectRatio: "1:1" }
          },
        });

        let imageUrl = null;
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
        if (!imageUrl) throw new Error("No image generated");
        setGeneratedImage(imageUrl);
      } else {
        const analysisResult = await performAnalysis(type, text);
        setResult(analysisResult);

        // Save to DB for persistent tools
        if (type === 'checker' || type === 'plagiarism' || type === 'grader') {
          await fetch('/api/save-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              text, 
              studentName, 
              type: type === 'checker' ? 'ai-detector' : type,
              result: analysisResult
            }),
          });
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
        const analysisResult = await performAnalysis('ai-detector', content);
        
        await fetch('/api/save-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: content, 
            studentName: file.name, 
            type: 'ai-detector',
            result: analysisResult
          }),
        });
      }
      setBulkFiles([]);
      fetchSubmissions();
      setView('dashboard');
    } catch (err: any) {
      setError('Bulk processing failed at some point: ' + err.message);
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
    { id: 'grader', name: 'Bar Grader', icon: Gavel, color: 'text-lali-palm' },
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
            <span className="text-xl font-black tracking-tighter text-lali-palm block leading-none">LALI</span>
            <span className="text-[10px] font-bold text-lali-sunset uppercase tracking-[0.2em]">Grader</span>
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
                  <div className="text-3xl font-black text-lali-palm/10 tracking-tighter leading-none">LALI</div>
                  <div className="text-xs font-bold text-lali-sunset tracking-[0.3em]">GRADER</div>
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
                        placeholder={view === 'grader' ? "Paste student essay submission here..." : "Paste text here for LALI forensic analysis..."}
                        className={cn(
                          "w-full p-8 focus:outline-none resize-none text-gray-800 leading-relaxed text-lg font-serif",
                          view === 'grader' ? "h-[300px]" : "h-[400px]"
                        )}
                      />
                      
                      {view === 'grader' && (
                        <div className="border-t border-gray-100 grid grid-cols-1 md:grid-cols-2">
                          <div className="border-r border-gray-100">
                            <div className="p-5 bg-lali-sand/20 flex items-center gap-3 border-b border-gray-100">
                              <BookOpen className="w-5 h-5 text-lali-palm" />
                              <span className="text-xs font-black text-lali-palm uppercase tracking-widest">Reference Material</span>
                            </div>
                            <textarea
                              value={referenceMaterial}
                              onChange={(e) => setReferenceMaterial(e.target.value)}
                              placeholder="Paste the past bar exam question or model answer here..."
                              className="w-full h-[200px] p-8 focus:outline-none resize-none text-gray-800 leading-relaxed text-sm font-serif bg-lali-sand/5"
                            />
                          </div>
                          <div>
                            <div className="p-5 bg-lali-ocean/10 flex items-center gap-3 border-b border-gray-100">
                              <ExternalLink className="w-5 h-5 text-lali-ocean" />
                              <span className="text-xs font-black text-lali-ocean uppercase tracking-widest">Reference URLs (Training)</span>
                            </div>
                            <textarea
                              value={referenceUrls}
                              onChange={(e) => setReferenceUrls(e.target.value)}
                              placeholder="Paste URLs to past exams or grading standards (one per line)..."
                              className="w-full h-[200px] p-8 focus:outline-none resize-none text-gray-800 leading-relaxed text-sm font-serif bg-lali-ocean/5"
                            />
                          </div>
                        </div>
                      )}
                      <div className="p-5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          {bulkFiles.length > 0 && (
                            <span className="text-xs font-black text-white bg-lali-palm px-4 py-1.5 rounded-full shadow-lg shadow-lali-palm/20">
                              {bulkFiles.length} FILES
                            </span>
                          )}
                          {view === 'grader' && !text.trim() && (
                            <span className="text-[10px] font-bold text-lali-sunset animate-pulse">
                              PASTE STUDENT ESSAY ABOVE TO BEGIN
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
                                "text-white px-12 py-5 rounded-2xl font-black shadow-2xl transition-all hover:-translate-y-1 active:scale-95",
                                tools.find(t => t.id === view)?.color.replace('text-', 'bg-'),
                                "disabled:bg-gray-200 disabled:shadow-none disabled:translate-y-0 disabled:scale-100"
                              )}
                            >
                              {isAnalyzing ? (
                                <div className="flex items-center gap-3">
                                  <Loader2 className="w-6 h-6 animate-spin" />
                                  <span>ANALYZING...</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  {view === 'grader' ? <Gavel className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                                  <span>{view === 'grader' ? 'GRADE STUDENT ESSAY' : `RUN ${tools.find(t => t.id === view)?.name?.toUpperCase()}`}</span>
                                </div>
                              )}
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
                        {view === 'grader' && (
                          <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-2xl shadow-gray-200/50 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-lali-palm via-lali-gold to-lali-sunset" />
                            <div className="text-center mb-8">
                              <div className="text-6xl font-black text-gray-900 mb-2 tracking-tighter">{result.potentialScore}%</div>
                              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">POTENTIAL SCORE</div>
                              <div className={cn("inline-block px-6 py-2 rounded-full font-black text-sm shadow-sm", getScoreColor(result.potentialScore))}>
                                {result.overallGrade?.toUpperCase()}
                              </div>
                            </div>
                            
                            <div className="space-y-6">
                              <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <MessageSquare className="w-3 h-3 text-lali-palm" /> STUDENT FEEDBACK
                                </div>
                                <p className="text-xs text-gray-700 leading-relaxed italic font-serif bg-lali-sand/30 p-4 rounded-xl border border-lali-palm/5">
                                  {result.studentFeedback}
                                </p>
                              </div>

                              <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Zap className="w-3 h-3 text-lali-gold" /> HELPFUL HINTS
                                </div>
                                <ul className="space-y-2">
                                  {result.helpfulHints?.map((hint: string, i: number) => (
                                    <li key={i} className="text-[10px] font-bold text-gray-600 flex items-start gap-2">
                                      <ChevronRight className="w-3 h-3 text-lali-sunset shrink-0 mt-0.5" />
                                      {hint}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                  <Scale className="w-3 h-3 text-lali-ocean" /> MODEL COMPARISON
                                </div>
                                <p className="text-[10px] text-gray-500 leading-relaxed">
                                  {result.modelComparison}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {view === 'checker' && (
                          <div className="bg-white rounded-3xl p-10 border border-gray-100 shadow-2xl shadow-gray-200/50 text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-lali-sunset via-lali-gold to-lali-ocean" />
                            <div className="text-6xl font-black text-gray-900 mb-2 tracking-tighter">{result.overallProbability}%</div>
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-8">AI PROBABILITY</div>
                            <div className={cn("p-5 rounded-2xl border-2 font-black text-xl mb-8 shadow-sm", getScoreColor(result.overallProbability))}>
                              {result.verdict?.toUpperCase()}
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
                          <div className="text-[10px] text-gray-400 font-mono">LALI-REF: {sub.id?.toUpperCase()}</div>
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
                      {selectedSubmission.verdict?.toUpperCase()}
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
