
import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Video, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  BookOpen, 
  GraduationCap, 
  Globe, 
  Download,
  ChevronDown,
  Printer,
  XCircle,
  RotateCcw,
  ChevronUp,
  Settings,
  Sparkles
} from 'lucide-react';
import katex from 'katex';
import { AcademicLevel, Language, Quiz, UploadedFile, Question } from './types';
import { generateQuiz, generateQuestionImage } from './services/geminiService';

/**
 * Component to safely render text mixed with LaTeX math
 */
const SmartText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const renderContent = () => {
    if (!text) return null;
    
    // Split by $ delimiters
    const parts = text.split(/(\$.*?\$)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const formula = part.slice(1, -1);
        try {
          // Check for common hallucinations and fix them if possible
          let cleanedFormula = formula
            .replace(/^rac/, '\\frac') // Fix missing backslash for frac
            .replace(/^ext/, '\\text') // Fix missing backslash for text
            .replace(/ext\{√\}/g, '\\sqrt') // Fix weird square root hallucinations
            .replace(/√/g, '\\sqrt');     // Ensure literal square root symbols are handled

          const html = katex.renderToString(cleanedFormula, {
            throwOnError: false,
            displayMode: false,
            strict: false
          });
          return <span key={index} className="mx-0.5 inline-block align-middle scale-110" dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (e) {
          return <span key={index}>{part}</span>;
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  return <div className={className}>{renderContent()}</div>;
};

const App: React.FC = () => {
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [level, setLevel] = useState<AcademicLevel>(AcademicLevel.OL);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);
  const [topics, setTopics] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [showMobileConfig, setShowMobileConfig] = useState(false);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const type = selectedFile.type.startsWith('image') ? 'image' : 
                   selectedFile.type.startsWith('video') ? 'video' : 'pdf';
      
      setFile({
        file: selectedFile,
        preview: URL.createObjectURL(selectedFile),
        type,
        base64
      });
    };
    reader.readAsDataURL(selectedFile);
    setError(null);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetAll = () => {
    clearFile();
    setLevel(AcademicLevel.OL);
    setLanguage(Language.ENGLISH);
    setTopics('');
    setQuiz(null);
    setError(null);
    setUserAnswers({});
    setShowResults(false);
    setShowMobileConfig(false);
    setGeneratingImages({});
  };

  const startGeneration = async () => {
    if (!file) {
      setError("Please upload a study material first.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setQuiz(null);
    setUserAnswers({});
    setShowResults(false);

    try {
      const generatedQuiz = await generateQuiz(
        { data: file.base64!, mimeType: file.file.type, type: file.type },
        { level, language, topics }
      );
      setQuiz(generatedQuiz);
      
      // Secondary Phase: Generate AI Visuals
      generatedQuiz.questions.forEach(async (q) => {
        if (q.image_description) {
          setGeneratingImages(prev => ({ ...prev, [q.question_id]: true }));
          const imageUrl = await generateQuestionImage(q.image_description);
          if (imageUrl) {
            setQuiz(prev => {
              if (!prev) return prev;
              const updatedQuestions = prev.questions.map(question => 
                question.question_id === q.question_id 
                ? { ...question, image_url: imageUrl } 
                : question
              );
              return { ...prev, questions: updatedQuestions };
            });
          }
          setGeneratingImages(prev => ({ ...prev, [q.question_id]: false }));
        }
      });

    } catch (err: any) {
      setError(err.message || "Failed to generate quiz. Please check your API key.");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPdf = async (includeAnswers: boolean) => {
    if (!quiz) return;
    setIsDownloading(true);
    setShowDownloadMenu(false);

    const container = document.createElement('div');
    container.className = 'pdf-container';
    
    const content = document.createElement('div');
    content.className = `pdf-content ${language === Language.SINHALA ? 'sinhala' : ''}`;
    
    const renderPdfText = (text: string) => {
      if (!text) return '';
      return text.split(/(\$.*?\$)/g).map(part => {
        if (part.startsWith('$') && part.endsWith('$')) {
          let formula = part.slice(1, -1)
            .replace(/^rac/, '\\frac')
            .replace(/^ext/, '\\text')
            .replace(/ext\{√\}/g, '\\sqrt')
            .replace(/√/g, '\\sqrt');
          try {
            return katex.renderToString(formula, { throwOnError: false });
          } catch (e) { return part; }
        }
        return part;
      }).join('');
    };

    const headerHtml = `
      <div class="pdf-header">
        <h1 style="font-size: 24pt; margin: 0; font-weight: 800;">${quiz.quiz_metadata.title}</h1>
        <h2 style="font-size: 16pt; margin: 8px 0; color: #333;">${quiz.quiz_metadata.subject} • ${quiz.quiz_metadata.academic_level}</h2>
        <p style="font-size: 10pt; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Evaluation Paper - AI Enhanced Assessment</p>
      </div>
    `;

    const questionsHtml = quiz.questions.map((q, i) => `
      <div class="pdf-question">
        <div style="font-weight: 700; font-size: 13pt; margin-bottom: 12px;">
          ${i + 1}. ${renderPdfText(q.stem)}
        </div>
        
        ${q.image_url ? `
          <div style="text-align: center; margin: 20px 0;">
            <img src="${q.image_url}" class="pdf-image" style="max-height: 250px; border: 1px solid #eee;" />
          </div>
        ` : ''}
        
        <div style="margin-left: 25px;">
          ${q.options.map((opt, optIdx) => `
            <div class="pdf-option">
              <span style="font-weight: 700; width: 25px; display: inline-block;">${String.fromCharCode(65 + optIdx)})</span>
              <span>${renderPdfText(opt)}</span>
            </div>
          `).join('')}
        </div>
        
        ${includeAnswers ? `
          <div class="pdf-feedback">
            <div style="font-weight: 800; font-size: 9pt; color: #166534; text-transform: uppercase; margin-bottom: 5px;">Correct Answer: ${String.fromCharCode(65 + q.correct_answer_index)}</div>
            <div><strong>Explanation:</strong> ${renderPdfText(q.explanation)}</div>
          </div>
        ` : ''}
      </div>
    `).join('');

    content.innerHTML = headerHtml + questionsHtml;
    container.appendChild(content);
    document.body.appendChild(container);

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${quiz.quiz_metadata.title.replace(/\s+/g, '_')}_${includeAnswers ? 'Answers' : 'Paper'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      // @ts-ignore
      await html2pdf().set(opt).from(container).save();
    } catch (err) {
      console.error("PDF Generation error:", err);
    } finally {
      if (document.body.contains(container)) document.body.removeChild(container);
      setIsDownloading(false);
    }
  };

  const handleAnswerSelect = (questionId: number, optionIndex: number) => {
    if (showResults) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const score = quiz ? quiz.questions.reduce((acc, q) => 
    userAnswers[q.question_id] === q.correct_answer_index ? acc + 1 : acc, 0
  ) : 0;

  return (
    <div className="min-h-screen pb-12 bg-slate-50">
      <header className="bg-indigo-600 text-white py-6 md:py-8 px-4 shadow-lg sticky top-0 z-30 md:static">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
          <div className="text-center md:text-left">
            <button onClick={resetAll} className="text-xl md:text-3xl font-bold flex items-center justify-center md:justify-start gap-2 md:gap-3">
              <GraduationCap className="w-8 h-8 md:w-10 md:h-10" />
              Exam Prep Gen
            </button>
            <p className="mt-1 md:mt-2 text-xs md:text-sm text-indigo-100 font-medium opacity-90">Instant AI-powered papers with readable Math & Visuals</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 md:mt-8">
        {!quiz && !isLoading && (
          <div className="flex flex-col md:grid md:grid-cols-3 gap-6 md:gap-8">
            <div className="md:hidden">
              <button onClick={() => setShowMobileConfig(!showMobileConfig)} className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between font-semibold text-slate-700">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" /> Quiz Settings
                </div>
                {showMobileConfig ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            <div className={`md:col-span-1 space-y-6 ${showMobileConfig ? 'block' : 'hidden md:block'}`}>
              <section className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-indigo-600" /> Configuration
                </h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Level</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[250px] overflow-y-auto pr-1 scrollbar-hide">
                      {Object.values(AcademicLevel).map(v => (
                        <button key={v} onClick={() => setLevel(v)} className={`px-2 py-2 rounded-lg text-xs font-bold transition-all border-2 ${level === v ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-600'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Language</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(Language).map(v => (
                        <button key={v} onClick={() => setLanguage(v)} className={`px-3 py-3 rounded-xl text-sm font-semibold transition-all border-2 flex items-center justify-center gap-2 ${language === v ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-100 text-slate-600'}`}>
                          <Globe className="w-4 h-4" /> {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Focus Topics</label>
                    <textarea className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none text-sm min-h-[80px]" placeholder="e.g. Maths - Surds, Science - Cells..." value={topics} onChange={(e) => setTopics(e.target.value)} />
                  </div>
                </div>
              </section>
            </div>

            <div className="md:col-span-2">
              <section className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" /> Upload Materials
                </h3>
                <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 md:p-10 hover:border-indigo-300 transition-colors min-h-[250px]">
                  {file ? (
                    <div className="text-center w-full">
                      <div className="mb-4 inline-block p-6 bg-indigo-50 rounded-full relative">
                        {file.type === 'pdf' && <FileText className="w-10 h-10 text-indigo-600" />}
                        {file.type === 'video' && <Video className="w-10 h-10 text-indigo-600" />}
                        {file.type === 'image' && <ImageIcon className="w-10 h-10 text-indigo-600" />}
                        <button onClick={clearFile} className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full shadow-md p-1 border border-slate-100"><XCircle className="w-7 h-7" /></button>
                      </div>
                      <h4 className="font-bold text-slate-800 mb-1 break-all px-4">{file.file.name}</h4>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center w-full py-10">
                      <div className="mb-6 p-5 bg-slate-50 rounded-full"><Upload className="w-12 h-12 text-slate-400" /></div>
                      <p className="text-slate-700 font-bold text-lg">Tap to upload study notes</p>
                      <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,image/*,video/*" onChange={handleFileUpload} />
                    </label>
                  )}
                </div>
                {error && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 text-sm border border-red-100"><AlertCircle className="w-5 h-5 shrink-0" /> {error}</div>}
                <button disabled={!file || isLoading} onClick={startGeneration} className={`mt-6 w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${!file || isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl'}`}>
                  {isLoading ? 'Processing...' : 'Create Visual Exam'}
                </button>
              </section>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="bg-white p-8 md:p-16 rounded-3xl shadow-sm border border-slate-200 text-center space-y-8">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 border-[6px] border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-[6px] border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800">Generating Exam Content</h2>
          </div>
        )}

        {quiz && (
          <div className="space-y-6 md:space-y-8">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-20">
              <div className="text-center md:text-left w-full md:w-auto">
                <h2 className="text-lg md:text-2xl font-black text-slate-800">{quiz.quiz_metadata.title}</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{quiz.quiz_metadata.subject}</p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative shrink-0">
                  <button onClick={() => setShowDownloadMenu(!showDownloadMenu)} disabled={isDownloading} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold h-10">
                    <Download className="w-4 h-4" /> <span>PDF</span> <ChevronDown className="w-3 h-3" />
                  </button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 py-2">
                      <button onClick={() => downloadPdf(false)} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 flex items-center gap-3 font-bold">Question Paper</button>
                      <button onClick={() => downloadPdf(true)} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 flex items-center gap-3 font-bold">Paper + Answers</button>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowResults(true)} disabled={Object.keys(userAnswers).length < quiz.questions.length} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black h-10 flex-grow md:flex-grow-0">Submit Exam</button>
              </div>
            </div>

            {showResults && (
              <div className="bg-indigo-600 text-white p-6 md:p-10 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center gap-6 justify-between animate-in zoom-in-95 duration-300">
                <div className="flex items-center gap-8">
                  <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30"><span className="text-3xl font-black">{Math.round((score / quiz.questions.length) * 100)}%</span></div>
                  <div><h3 className="text-2xl font-black">Grade Released</h3><p className="text-indigo-100 font-bold">Score: {score} / {quiz.questions.length} correct</p></div>
                </div>
                <button onClick={() => { setShowResults(false); setUserAnswers({}); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black">Retry Paper</button>
              </div>
            )}

            <div className="space-y-6">
              {quiz.questions.map((q, idx) => {
                const isCorrect = userAnswers[q.question_id] === q.correct_answer_index;
                return (
                  <article key={q.question_id} className={`bg-white p-5 md:p-8 rounded-2xl border-2 ${showResults ? (isCorrect ? 'border-green-400' : 'border-red-400') : 'border-slate-100'}`}>
                    <div className="space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full">Question {idx + 1}</span>
                          <SmartText text={q.stem} className={`text-lg md:text-xl font-bold text-slate-900 ${language === Language.SINHALA ? 'sinhala' : ''}`} />
                        </div>
                      </div>

                      {q.image_url && (
                        <div className="my-6 flex justify-center">
                          <img src={q.image_url} alt="Question Setup" className="max-w-full md:max-w-md h-auto rounded-2xl shadow-xl border border-slate-100" />
                        </div>
                      )}

                      <div className="flex flex-col gap-2.5">
                        {q.options.map((opt, optIdx) => {
                          let btnStyle = "border-slate-200 bg-slate-50/50 text-slate-900";
                          if (showResults) {
                            if (optIdx === q.correct_answer_index) btnStyle = "bg-green-50 border-green-500 text-green-700 font-bold";
                            else if (userAnswers[q.question_id] === optIdx) btnStyle = "bg-red-50 border-red-500 text-red-700";
                            else btnStyle = "opacity-40 grayscale text-slate-900";
                          } else if (userAnswers[q.question_id] === optIdx) {
                            btnStyle = "bg-indigo-600 border-indigo-600 text-white shadow-lg";
                          }

                          return (
                            <button key={optIdx} disabled={showResults} onClick={() => handleAnswerSelect(q.question_id, optIdx)} className={`p-4 rounded-xl text-left border-2 flex items-start gap-3 transition-all ${btnStyle}`}>
                              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black border ${userAnswers[q.question_id] === optIdx && !showResults ? 'bg-white text-indigo-600' : 'bg-white text-slate-700'}`}>{String.fromCharCode(65 + optIdx)}</span>
                              <SmartText text={opt} className={`text-base md:text-lg self-center ${language === Language.SINHALA ? 'sinhala' : ''}`} />
                            </button>
                          );
                        })}
                      </div>

                      {showResults && (
                        <div className={`mt-6 p-5 rounded-2xl border-2 ${isCorrect ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                          <h5 className="font-black text-xs uppercase mb-2">Pedagogical Feedback</h5>
                          <SmartText text={q.explanation} className={`text-sm md:text-base leading-relaxed ${language === Language.SINHALA ? 'sinhala' : ''}`} />
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>
      <footer className="text-center text-slate-400 text-xs font-bold py-8 border-t border-slate-100 mt-16">&copy; {new Date().getFullYear()} Exam Prep Gen</footer>
    </div>
  );
};

export default App;
