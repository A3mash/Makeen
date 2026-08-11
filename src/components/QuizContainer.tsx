import { useState, useEffect } from 'react';
import { updateSRSCard, saveLearningGap, getLearningGap, getSRSCardByQuestionId, logActivity, getSetting, getMaterialFile } from '../services/db';
import type { Question } from '../services/db';
import { calculateNextReview } from '../utils/srsEngine';

interface QuizContainerProps {
  initialQuestions: Question[];
  onComplete: () => void;
  onExit: () => void;
}

export default function QuizContainer({ initialQuestions, onComplete, onExit }: QuizContainerProps) {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(true);
  const [focusTimeSetting, setFocusTimeSetting] = useState(25);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [showExitModal, setShowExitModal] = useState(false);
  
  const [sessionStartTime] = useState(Date.now());
  const [showSummary, setShowSummary] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    timeSpentSeconds: 0,
    questionsAnswered: 0,
    correctAnswers: 0,
    gapsDiscovered: 0
  });

  const [pendingSrsUpdates, setPendingSrsUpdates] = useState<any[]>([]);
  const [pendingGapUpdates, setPendingGapUpdates] = useState<any[]>([]);
  const [pendingActivityLog, setPendingActivityLog] = useState(0);

  // PDF Viewer State
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showPdf, setShowPdf] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      const ft = await getSetting('focusTime');
      const time = ft ? ft.value : 25;
      setFocusTimeSetting(time);
      setTimeLeft(time * 60);
    }
    loadSettings();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsFocusMode(!isFocusMode);
          return isFocusMode ? 5 * 60 : focusTimeSetting * 60; // toggle between focus and break (5m)
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFocusMode, focusTimeSetting]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatStudyTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} دقيقة`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${remainingMins} ساعة`;
  };

  const handleOptionSelect = async (option: string) => {
    if (selectedOption) return;
    setSelectedOption(option);

    const question = questions[currentIndex];
    const isCorrect = option === question.correctAnswer;

    setSessionStats(prev => ({
      ...prev,
      questionsAnswered: prev.questionsAnswered + 1,
      correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
      gapsDiscovered: prev.gapsDiscovered + (!isCorrect ? 1 : 0)
    }));

    // Queue SRS Update
    let srsCard = await getSRSCardByQuestionId(question.id);
    if (!srsCard) {
      srsCard = {
        id: crypto.randomUUID(),
        questionId: question.id,
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        nextReviewDate: Date.now()
      };
    }
    const updatedSRS = calculateNextReview(srsCard, isCorrect);
    const fullCard = { ...srsCard, ...updatedSRS };
    setPendingSrsUpdates(prev => {
      const existing = prev.findIndex(u => u.id === fullCard.id);
      if (existing >= 0) {
        const newArr = [...prev];
        newArr[existing] = fullCard;
        return newArr;
      }
      return [...prev, fullCard];
    });
    
    // Queue Activity Log
    setPendingActivityLog(prev => prev + 1);

    // Queue Gap and push question to end if incorrect
    if (!isCorrect) {
      let gap = await getLearningGap(question.id);
      if (!gap) {
        gap = {
          id: question.id,
          conceptOrQuestionId: question.id,
          errorCount: 1,
          masteryStatus: 'Novice'
        };
      } else {
        gap.errorCount += 1;
        gap.masteryStatus = 'Learning';
      }
      
      setPendingGapUpdates(prev => {
        const existing = prev.findIndex(u => u.id === gap!.id);
        if (existing >= 0) {
          const newArr = [...prev];
          newArr[existing] = gap;
          return newArr;
        }
        return [...prev, gap];
      });

      // Push this question to the end of the array so it reappears
      setQuestions(prev => [...prev, question]);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
    } else {
      handleCompleteQuiz();
    }
  };

  const commitUpdates = async (studyTimeSecs: number) => {
    for (const srs of pendingSrsUpdates) await updateSRSCard(srs);
    for (const gap of pendingGapUpdates) await saveLearningGap(gap);
    await logActivity(pendingActivityLog, studyTimeSecs);
  };

  const handleCompleteQuiz = () => {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    setSessionStats(prev => ({ ...prev, timeSpentSeconds: timeSpent }));
    setShowSummary(true);
    commitUpdates(timeSpent); // Save async in background
  };

  const handleExitClick = () => {
    setShowExitModal(true);
  };

  const confirmExitAndSave = async () => {
    const timeSpent = Math.floor((Date.now() - sessionStartTime) / 1000);
    await commitUpdates(timeSpent);
    onExit();
  };

  const confirmExitAndDiscard = () => {
    onExit();
  };

  if (questions.length === 0) {
    return <div className="p-8 text-center text-on-surface">لا توجد أسئلة لعرضها.</div>;
  }

  if (showSummary) {
    const accuracy = sessionStats.questionsAnswered > 0 
      ? Math.round((sessionStats.correctAnswers / sessionStats.questionsAnswered) * 100) 
      : 0;
      
    return (
      <div className="flex flex-col h-full bg-background font-body-md items-center justify-center p-6 animate-entrance">
        <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-lg border border-outline-variant max-w-md w-full text-center">
          <div className="w-24 h-24 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-5xl">trophy</span>
          </div>
          
          <h2 className="text-headline-sm font-bold text-on-surface mb-2">ملخص الجلسة</h2>
          <p className="text-on-surface-variant mb-8">عمل رائع! لقد أنهيت جلسة الدراسة بنجاح.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8 text-right">
            <div className="bg-surface-container-low p-4 rounded-xl">
              <span className="material-symbols-outlined text-primary mb-1">timer</span>
              <p className="text-label-sm text-on-surface-variant">وقت الدراسة</p>
              <p className="font-bold text-title-md text-on-surface">{formatStudyTime(sessionStats.timeSpentSeconds)}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl">
              <span className="material-symbols-outlined text-primary mb-1">check_circle</span>
              <p className="text-label-sm text-on-surface-variant">دقة الإجابات</p>
              <p className="font-bold text-title-md text-on-surface">{accuracy}٪</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl">
              <span className="material-symbols-outlined text-tertiary mb-1">quiz</span>
              <p className="text-label-sm text-on-surface-variant">أسئلة محلولة</p>
              <p className="font-bold text-title-md text-on-surface">{sessionStats.questionsAnswered}</p>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl">
              <span className="material-symbols-outlined text-error mb-1">psychology</span>
              <p className="text-label-sm text-on-surface-variant">فجوات مكتشفة</p>
              <p className="font-bold text-title-md text-on-surface">{sessionStats.gapsDiscovered}</p>
            </div>
          </div>
          
          <button 
            onClick={onComplete}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm text-lg"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedOption === currentQuestion.correctAnswer;

  const handleReferenceClick = async () => {
    if (!currentQuestion.materialId) return;
    
    if (!pdfUrl) {
      setIsPdfLoading(true);
      setShowPdf(true);
      try {
        const fileBlob = await getMaterialFile(currentQuestion.materialId);
        if (fileBlob) {
          const url = URL.createObjectURL(fileBlob);
          setPdfUrl(url);
        } else {
          alert('تعذر العثور على الملف الأصلي. يبدو أنه تم رفع هذه المادة قبل تفعيل ميزة حفظ الملفات الأصلية.');
          setShowPdf(false);
        }
      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء فتح الملف.');
        setShowPdf(false);
      } finally {
        setIsPdfLoading(false);
      }
    } else {
      setShowPdf(true);
    }
  };

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  return (
    <div className="flex h-full bg-background font-body-md text-on-background w-full animate-entrance overflow-hidden">
      
      {/* Quiz Area */}
      <div className={`flex flex-col h-full transition-all duration-300 relative ${showPdf ? 'w-full lg:w-1/2 border-l border-outline-variant/30 hidden lg:flex' : 'w-full'}`}>
      
      {/* Internal Header for Quiz */}
      <header className="bg-surface-container-lowest/80 backdrop-blur-md shadow-sm sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b border-outline-variant/30 mb-6">
        <button 
          onClick={handleExitClick}
          className="flex items-center gap-2 text-on-surface-variant hover:text-error transition-colors font-bold px-3 py-2 rounded-lg hover:bg-error-container/20"
        >
          <span className="material-symbols-outlined">close</span>
          خروج
        </button>
        
        {/* Timer Bar */}
        <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2 rounded-full border border-outline-variant">
          <span className={`material-symbols-outlined ${isFocusMode ? 'text-primary' : 'text-tertiary'}`}>timer</span>
          <span className="font-bold text-title-md font-mono">{formatTime(timeLeft)}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-bold hidden sm:inline-block ${isFocusMode ? 'bg-primary-container text-on-primary-container' : 'bg-tertiary-container text-on-tertiary-container'}`}>
            {isFocusMode ? 'وقت التركيز' : 'وقت الراحة'}
          </span>
        </div>
        
        <div className="text-label-md text-on-surface-variant font-bold">
          {currentIndex + 1} / {questions.length}
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="max-w-3xl mx-auto w-full flex-1 overflow-y-auto px-4 pt-4 pb-48 custom-scrollbar flex flex-col relative">
        {/* Question Card */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant flex flex-col gap-6 relative flex-shrink-0">
          <h2 className="text-title-md md:text-headline-md font-bold leading-relaxed text-on-surface">
            {currentQuestion.text}
          </h2>
          
          {currentQuestion.reference?.pageNumber && (
            <button 
              onClick={handleReferenceClick}
              className="flex items-center gap-1 text-primary font-label-sm bg-primary-fixed/30 w-fit px-3 py-1.5 rounded-lg border border-primary/20 hover:bg-primary-fixed hover:text-on-primary-fixed transition-colors cursor-pointer group"
              title="انقر لفتح المرجع"
            >
              <span className="material-symbols-outlined text-[16px] group-hover:scale-110 transition-transform">menu_book</span>
              <span>المرجع: صفحة {currentQuestion.reference.pageNumber}</span>
              <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 mr-1">open_in_new</span>
            </button>
          )}

          <div className="flex flex-col gap-3 mt-2">
            {currentQuestion.options.map((opt, i) => {
              let btnClass = "border border-outline-variant text-on-surface bg-surface hover:bg-surface-container-high";
              if (selectedOption) {
                if (opt === currentQuestion.correctAnswer) {
                  btnClass = "bg-primary-fixed text-on-primary-fixed border-primary shadow-sm font-bold scale-[1.02]";
                } else if (opt === selectedOption && !isCorrect) {
                  btnClass = "bg-error-container text-on-error-container border-error font-bold";
                } else {
                  btnClass = "opacity-40 border-outline-variant text-on-surface-variant";
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleOptionSelect(opt)}
                  disabled={!!selectedOption}
                  className={`p-4 rounded-xl text-right transition-all duration-300 ${btnClass}`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gap Remediation Block (Immediate and fast) */}
        {selectedOption && !isCorrect && (
          <div className="mt-6 p-6 rounded-2xl bg-secondary-container/20 border-l-4 border-secondary text-on-surface animate-entrance flex-shrink-0 shadow-inner">
            <div className="flex items-center gap-2 text-secondary font-bold mb-3">
              <span className="material-symbols-outlined text-[24px]">lightbulb</span>
              <span className="text-title-md">نصيحة سريعة لردم الفجوة</span>
            </div>
            <p className="leading-relaxed font-medium">
              {currentQuestion.rationale || `الإجابة الصحيحة هي: ${currentQuestion.correctAnswer}. لقد أضفنا هذا السؤال لنهاية الجلسة لكي تحاول مرة أخرى لاحقاً.`}
            </p>
          </div>
        )}

      </div>

        {/* Fixed Bottom Bar: Next Button */}
        {selectedOption && (
          <div className={`absolute bottom-0 right-0 p-4 border-t border-outline-variant/30 bg-surface-container-lowest/80 backdrop-blur-md z-30 transition-all duration-300 ${showPdf ? 'w-full' : 'w-full lg:w-[768px] lg:left-1/2 lg:-translate-x-1/2 lg:right-auto'}`}>
            <button
              onClick={handleNext}
              className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm text-lg flex items-center justify-center gap-2"
            >
              <span>{currentIndex < questions.length - 1 ? 'السؤال التالي' : 'إنهاء الاختبار'}</span>
              <span className="material-symbols-outlined rtl:rotate-180">arrow_forward</span>
            </button>
          </div>
        )}
      </div>

      {/* PDF Viewer Area (Left side in RTL layout) */}
      {showPdf && (
        <div className="w-full lg:w-1/2 h-full bg-surface-container-lowest flex flex-col z-50 absolute lg:relative inset-0">
          <div className="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/80 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">picture_as_pdf</span>
              <span className="font-bold text-title-md">المستند المرجعي</span>
              <span className="text-sm bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md mr-2">صفحة {currentQuestion.reference?.pageNumber}</span>
            </div>
            <button 
              onClick={() => setShowPdf(false)} 
              className="p-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors flex items-center justify-center text-on-surface-variant hover:text-error"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <div className="flex-1 w-full relative bg-surface-container">
            {isPdfLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant gap-4">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
                <p className="font-medium">جاري تحميل المستند...</p>
              </div>
            ) : pdfUrl ? (
              <iframe 
                src={`${pdfUrl}#page=${currentQuestion.reference?.pageNumber || 1}`} 
                className="w-full h-full border-0"
                title="مستند المرجع"
              />
            ) : null}
          </div>
        </div>
      )}

      {/* Exit Warning Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-on-background/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest p-6 rounded-2xl max-w-md w-full shadow-lg border border-outline-variant animate-entrance">
            <div className="flex items-center gap-3 text-error mb-4">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="font-headline-sm font-bold text-on-surface">تأكيد الخروج</h3>
            </div>
            <p className="text-on-surface-variant mb-6 text-body-md">
              هل تود حفظ تقدمك السابق (نقاط الخبرة والفجوات المعرفية التي تمت معالجتها) قبل الخروج؟
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmExitAndSave} className="bg-primary text-on-primary py-3 rounded-xl font-bold w-full hover:bg-primary/90 transition-colors">
                نعم، حفظ التقدم والخروج
              </button>
              <button onClick={confirmExitAndDiscard} className="bg-error-container text-on-error-container py-3 rounded-xl font-bold w-full hover:bg-error-container/80 transition-colors">
                لا، تجاهل الجلسة بالكامل
              </button>
              <button onClick={() => setShowExitModal(false)} className="bg-surface border border-outline-variant text-on-surface py-3 rounded-xl font-bold w-full hover:bg-surface-container-high transition-colors">
                إلغاء ومتابعة الاختبار
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
