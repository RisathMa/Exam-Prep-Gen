
import React, { useState, useRef } from 'react';
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
import { AcademicLevel, Language, Quiz, UploadedFile, Question } from './types';
import { generateQuiz, generateQuestionImage } from './services/geminiService';

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
      
      // Secondary Phase: Generate AI Visuals for questions that have descriptions
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
      setError(err.message || "Failed to generate quiz. Please check your API key and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPdf = async (includeAnswers: boolean) => {
    if (!quiz) return;
    setIsDownloading(true);
    setShowDownloadMenu(false);

    // Create a temporary container for the PDF content
    const container = document.createElement('div');
    container.className = 'pdf-container';
    
    const content = document.createElement('div');
    content.className = `pdf-content ${language === Language.SINHALA ? 'sinhala' : ''}`;
    
    const headerHtml = `
      <div class="pdf-header">
        <h1 style="font-size: 24pt; margin: 0; font-weight: 800;">${quiz.quiz_metadata.title}</h1>
        <h2 style="font-size: 16pt; margin: 8px 0; color: #333;">${quiz.quiz_metadata.subject} • ${quiz.quiz_metadata.academic_level}</h2>
        <p style="font-size: 10pt; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Evaluation Paper - AI Enhanced Assessment</p>
      </div>
    `;

    const questionsHtml = quiz.questions.map((q, i) => `
      <div class="pdf-question">
        <div style="font-weight: 700; font-size: 13pt; margin-bottom: 12px; display: flex; gap: 10px;">
          <span>${i + 1}.</span>
          <span>${q.stem}</span>
        </div>
        
        ${q.image_url ? `
          <div style="text-align: center; margin: 20px 0;">
            <img src="${q.image_url}" class="pdf-image" style="max-height: 250px; border: 1px solid #eee;" />
          </div>
        ` : ''}
        
        <div style="margin-left: 25px; margin-top: 15px;">
          ${q.options.map((opt, optIdx) => `
            <div class="pdf-option" style="margin-bottom: 8px;">
              <span style="font-weight: 700; width: 25px; display: inline-block;">${String.fromCharCode(65 + optIdx)})</span>
              <span>${opt}</span>
            </div>
          `).join('')}
        </div>
        
        ${includeAnswers ? `
          <div class="pdf-feedback">
            <div style="font-weight: 800; font-size: 9pt; color: #166534; text-transform: uppercase; margin-bottom: 5px;">Correct Answer: ${String.fromCharCode(65 + q.correct_answer_index)}</div>
            <div style="color: #14532d;"><strong>Explanation:</strong> ${q.explanation}</div>
          </div>
        ` : ''}
      </div>
    `).join('');

    content.innerHTML = headerHtml + questionsHtml;
    container.appendChild(content);
    document.body.appendChild(container);

    // Options for html2pdf
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${quiz.quiz_metadata.title.replace(/\s+/g, '_')}_${includeAnswers ? 'Answers' : 'Paper'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        backgroundColor: '#ffffff',
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // Wait for a few frames to ensure the browser has rendered the appended hidden element
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // @ts-ignore
      const worker = html2pdf().set(opt).from(container);
      await worker.save();
    } catch (err) {
      console.error("PDF Generation error:", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      // Clean up the temporary element
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
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
      {/* Header */}
      <header className="bg-indigo-600 text-white py-6 md:py-8 px-4 shadow-lg sticky top-0 z-30 md:static" role="banner">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
          <div className="text-center md:text-left">
            <button 
              onClick={resetAll} 
              className="text-xl md:text-3xl font-bold flex items-center justify-center md:justify-start gap-2 md:gap-3 transition-opacity hover:opacity-90"
            >
              <GraduationCap className="w-8 h-8 md:w-10 md:h-10" />
              Exam Prep Gen
            </button>
            <p className="mt-1 md:mt-2 text-xs md:text-sm text-indigo-100 font-medium opacity-90">Instant AI-powered practice papers with visuals</p>
          </div>
          <div className="hidden md:block bg-indigo-500/30 p-2 rounded-lg backdrop-blur-sm text-xs border border-white/20">
            Powered by Gemini AI Multi-Model
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 md:mt-8">
        {!quiz && !isLoading && (
          <div className="flex flex-col md:grid md:grid-cols-3 gap-6 md:gap-8">
            <div className="md:hidden">
              <button 
                onClick={() => setShowMobileConfig(!showMobileConfig)}
                className="w-full bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between font-semibold text-slate-700"
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  Quiz Settings
                </div>
                {showMobileConfig ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            <div id="config-panel" className={`md:col-span-1 space-y-6 ${showMobileConfig ? 'block' : 'hidden md:block'}`}>
              <section className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                    Configuration
                  </h3>
                  <button onClick={resetAll} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Academic Level</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[250px] overflow-y-auto pr-1 scrollbar-hide">
                      {Object.values(AcademicLevel).map(v => (
                        <button
                          key={v}
                          onClick={() => setLevel(v)}
                          className={`px-2 py-2 rounded-lg text-xs font-bold transition-all border-2 text-center ${
                            level === v 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'bg-white border-slate-100 text-slate-600'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Language</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(Language).map(v => (
                        <button
                          key={v}
                          onClick={() => setLanguage(v)}
                          className={`px-3 py-3 rounded-xl text-sm font-semibold transition-all border-2 flex items-center justify-center gap-2 ${
                            language === v 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'bg-white border-slate-100 text-slate-600'
                          }`}
                        >
                          <Globe className="w-4 h-4" />
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Focus Topics</label>
                    <textarea 
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-500 outline-none text-sm min-h-[80px]"
                      placeholder="e.g. Science - Plants, Math - Equations..."
                      value={topics}
                      onChange={(e) => setTopics(e.target.value)}
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="md:col-span-2">
              <section className="bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-200 h-full flex flex-col">
                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-indigo-600" />
                  Upload Materials
                </h3>

                <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-6 md:p-10 hover:border-indigo-300 transition-colors group min-h-[250px]">
                  {file ? (
                    <div className="text-center w-full">
                      <div className="mb-4 inline-block p-6 bg-indigo-50 rounded-full relative">
                        {file.type === 'pdf' && <FileText className="w-10 h-10 md:w-12 md:h-12 text-indigo-600" />}
                        {file.type === 'video' && <Video className="w-10 h-10 md:w-12 md:h-12 text-indigo-600" />}
                        {file.type === 'image' && <ImageIcon className="w-10 h-10 md:w-12 md:h-12 text-indigo-600" />}
                        <button onClick={clearFile} className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full shadow-md p-1 border border-slate-100">
                          <XCircle className="w-7 h-7" />
                        </button>
                      </div>
                      <h4 className="font-bold text-slate-800 mb-1 break-all px-4">{file.file.name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{(file.file.size / 1024 / 1024).toFixed(2)} MB • {file.type}</p>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center w-full py-10">
                      <div className="mb-6 p-5 bg-slate-50 rounded-full group-hover:bg-indigo-50 transition-all">
                        <Upload className="w-12 h-12 text-slate-400 group-hover:text-indigo-500" />
                      </div>
                      <p className="text-slate-700 font-bold text-lg">Tap to upload study notes</p>
                      <p className="text-sm text-slate-400 mt-2 text-center">AI will auto-generate diagrams for Science/Maths/History</p>
                      <input ref={fileInputRef} type="file" className="hidden" accept="application/pdf,image/*,video/*" onChange={handleFileUpload} />
                    </label>
                  )}
                </div>

                {error && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 text-sm border border-red-100" role="alert">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  disabled={!file || isLoading}
                  onClick={startGeneration}
                  className={`mt-6 w-full py-4 md:py-5 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${
                    !file || isLoading 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200'
                  }`}
                >
                  {isLoading ? 'Processing Material...' : 'Create Visual Exam'}
                </button>
              </section>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="bg-white p-8 md:p-16 rounded-3xl shadow-sm border border-slate-200 text-center space-y-8 animate-pulse">
            <div className="relative w-20 h-20 md:w-28 md:h-28 mx-auto">
              <div className="absolute inset-0 border-[6px] border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-[6px] border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <Sparkles className="absolute inset-0 m-auto w-10 h-10 md:w-14 md:h-14 text-indigo-600" />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-black text-slate-800">Generating Exam Content</h2>
              <p className="text-slate-500 max-w-sm mx-auto text-sm leading-relaxed">
                Analyzing material and designing custom illustrations for {level} standards...
              </p>
            </div>
          </div>
        )}

        {quiz && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-4 z-20">
              <div className="text-center md:text-left w-full md:w-auto">
                <h2 className="text-lg md:text-2xl font-black text-slate-800 truncate max-w-[280px] md:max-w-md">{quiz.quiz_metadata.title}</h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{quiz.quiz_metadata.subject} • {quiz.quiz_metadata.academic_level}</p>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative shrink-0">
                  <button 
                    onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                    disabled={isDownloading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs md:text-sm font-bold hover:bg-slate-900 transition-all h-10 md:h-12"
                  >
                    {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>{isDownloading ? 'Working...' : 'PDF'}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showDownloadMenu && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-slate-100 z-50 py-2">
                      <button onClick={() => downloadPdf(false)} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 flex items-center gap-3 font-bold">
                        <FileText className="w-5 h-5 text-indigo-500" /> Question Paper
                      </button>
                      <button onClick={() => downloadPdf(true)} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-indigo-50 flex items-center gap-3 font-bold border-t border-slate-50">
                        <Printer className="w-5 h-5 text-indigo-500" /> Paper + Answers
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setShowResults(true)}
                  disabled={Object.keys(userAnswers).length < quiz.questions.length}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-black shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all h-10 md:h-12 flex-grow md:flex-grow-0"
                >
                  Submit Exam
                </button>
              </div>
            </div>

            {showResults && (
              <div className="bg-indigo-600 text-white p-6 md:p-10 rounded-3xl shadow-2xl flex flex-col md:flex-row items-center gap-6 justify-between animate-in zoom-in-95 duration-300">
                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 text-center md:text-left">
                  <div className="w-20 h-20 md:w-28 md:h-28 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30 backdrop-blur-sm">
                    <span className="text-3xl md:text-5xl font-black">{Math.round((score / quiz.questions.length) * 100)}%</span>
                  </div>
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black">Grade Released</h3>
                    <p className="text-indigo-100 font-bold opacity-90">Score: {score} / {quiz.questions.length} correct</p>
                  </div>
                </div>
                <button onClick={() => { setShowResults(false); setUserAnswers({}); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full md:w-auto px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black shadow-xl hover:bg-indigo-50">
                  Retry Paper
                </button>
              </div>
            )}

            <div className="space-y-6">
              {quiz.questions.map((q, idx) => {
                const isCorrect = userAnswers[q.question_id] === q.correct_answer_index;
                const isImageLoading = generatingImages[q.question_id];

                return (
                  <article key={q.question_id} className={`bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border-2 transition-all ${
                    showResults 
                      ? isCorrect ? 'border-green-400 bg-green-50/10' : 'border-red-400 bg-red-50/10'
                      : 'border-slate-100 hover:border-indigo-200'
                  }`}>
                    <div className="space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full">Question {idx + 1}</span>
                          <h4 className={`text-lg md:text-xl font-bold text-slate-800 leading-tight ${language === Language.SINHALA ? 'sinhala' : ''}`}>
                            {q.stem}
                          </h4>
                        </div>
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md uppercase tracking-tight shrink-0">{q.cognitive_level}</span>
                      </div>

                      {/* AI Generated Image Rendering */}
                      {(isImageLoading || q.image_url) && (
                        <div className="my-6 flex justify-center">
                          {isImageLoading ? (
                            <div className="w-full max-w-sm aspect-square bg-slate-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200 animate-pulse">
                              <Sparkles className="w-10 h-10 text-indigo-300 mb-2" />
                              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Generating Visual...</p>
                            </div>
                          ) : (
                            <div className="relative group">
                              <img 
                                src={q.image_url} 
                                alt={q.image_description} 
                                className="max-w-full md:max-w-md h-auto rounded-2xl shadow-xl border border-slate-100 transition-transform group-hover:scale-[1.02]" 
                              />
                              <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1.5 shadow-sm border border-slate-200">
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                <span className="text-[8px] font-bold text-slate-700 uppercase">AI Generated</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-2.5">
                        {q.options.map((opt, optIdx) => {
                          let btnStyle = "border-slate-100 text-slate-700 bg-slate-50/50 hover:bg-white";
                          if (showResults) {
                            if (optIdx === q.correct_answer_index) btnStyle = "bg-green-50 border-green-500 text-green-700 font-bold";
                            else if (userAnswers[q.question_id] === optIdx) btnStyle = "bg-red-50 border-red-500 text-red-700";
                            else btnStyle = "opacity-40 grayscale pointer-events-none";
                          } else if (userAnswers[q.question_id] === optIdx) {
                            btnStyle = "bg-indigo-600 border-indigo-600 text-white shadow-lg";
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={showResults}
                              onClick={() => handleAnswerSelect(q.question_id, optIdx)}
                              className={`p-4 md:p-5 rounded-xl text-left transition-all border-2 flex items-start gap-3 ${btnStyle}`}
                            >
                              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-black border ${
                                userAnswers[q.question_id] === optIdx || (showResults && optIdx === q.correct_answer_index)
                                  ? 'bg-white text-indigo-600 border-transparent'
                                  : 'bg-white text-slate-400 border-slate-200'
                              }`}>
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className={`text-base md:text-lg flex-grow self-center ${language === Language.SINHALA ? 'sinhala' : ''}`}>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {showResults && (
                        <div className={`mt-6 p-5 rounded-2xl border-2 ${isCorrect ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4" />
                            <h5 className="font-black text-xs uppercase tracking-widest">Pedagogical Feedback</h5>
                          </div>
                          <p className={`text-sm md:text-base font-medium leading-relaxed ${language === Language.SINHALA ? 'sinhala' : ''}`}>
                            {q.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              
              <div className="flex justify-center mt-8 pb-12">
                 <button onClick={resetAll} className="px-10 py-5 bg-white text-slate-700 rounded-2xl font-black shadow-lg hover:bg-slate-50 transition-all flex items-center gap-3 border border-slate-100">
                  <RotateCcw className="w-5 h-5 text-indigo-600" /> New Assessment
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-4 mt-16 text-center text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] pb-8 border-t border-slate-100 pt-8">
        <p>&copy; {new Date().getFullYear()} Exam Prep Gen • AI-Assisted Pedagogy</p>
      </footer>
    </div>
  );
};

export default App;
