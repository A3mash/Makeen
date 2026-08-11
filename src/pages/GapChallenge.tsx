import { useState, useEffect } from 'react';
import { getAllLearningGaps, getQuestionById } from '../services/db';
import type { Question } from '../services/db';
import QuizContainer from '../components/QuizContainer';
import { useNavigate } from 'react-router-dom';

export default function GapChallenge() {
  const [challengeQuestions, setChallengeQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadGaps() {
      try {
        const gaps = await getAllLearningGaps();
        
        // Filter out mastered concepts (e.g. we only want Novice or Learning)
        const activeGaps = gaps.filter(g => g.masteryStatus !== 'Mastered');
        
        // Sort by errorCount descending to prioritize worst gaps
        activeGaps.sort((a, b) => b.errorCount - a.errorCount);
        
        // Take top 10 gaps for this challenge session
        const challengeGaps = activeGaps.slice(0, 10);
        
        const qs: Question[] = [];
        for (const gap of challengeGaps) {
          const q = await getQuestionById(gap.conceptOrQuestionId);
          if (q) {
            qs.push(q);
          }
        }
        
        // Shuffle questions
        qs.sort(() => Math.random() - 0.5);
        
        setChallengeQuestions(qs);
      } catch (error) {
        console.error("Failed to load gap questions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadGaps();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-background">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-4xl animate-spin text-primary">sync</span>
          <p>جاري تجهيز تحدي الفجوات...</p>
        </div>
      </div>
    );
  }

  if (challengeQuestions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-on-background p-4 text-center">
        <span className="material-symbols-outlined text-6xl text-primary-fixed mb-4">celebration</span>
        <h2 className="text-headline-sm font-bold mb-2">لا توجد فجوات معرفية!</h2>
        <p className="text-on-surface-variant mb-8 max-w-md">أنت متفوق! جميع المفاهيم التي تم اختبارك بها قد أجبت عليها بشكل صحيح أو تم إتقانها. استمر في دراسة مواد جديدة.</p>
        <button onClick={() => navigate('/materials')} className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {!isQuizStarted ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-error-container text-on-error-container rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-4xl">warning</span>
          </div>
          <h1 className="text-headline-md font-bold text-on-surface mb-2">تحدي الفجوات النهائية</h1>
          <p className="text-on-surface-variant mb-8">
            لقد تم تجميع {challengeQuestions.length} أسئلة أخطأت فيها سابقاً. حان الوقت لردم هذه الفجوات وتحسين مستواك الدراسي!
          </p>
          <button 
            onClick={() => setIsQuizStarted(true)}
            className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold shadow-md hover:bg-primary-container transition-colors"
          >
            بدء التحدي
          </button>
          <button 
            onClick={() => navigate('/materials')}
            className="w-full mt-4 bg-transparent border border-outline-variant text-primary py-4 rounded-xl font-bold transition-colors hover:bg-surface-container-low"
          >
            تأجيل
          </button>
        </div>
      ) : (
        <QuizContainer 
          initialQuestions={challengeQuestions} 
          onComplete={() => {
            alert('تم إنهاء تحدي الفجوات! ستتم إعادتك للرئيسية.');
            navigate('/materials');
          }}
          onExit={() => setIsQuizStarted(false)}
        />
      )}
    </div>
  );
}
