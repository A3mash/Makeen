import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getQuestionsByMaterial } from '../services/db';
import type { Question } from '../services/db';
import QuizContainer from '../components/QuizContainer';

export default function MaterialQuiz() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadQuestions() {
      if (!materialId) return;
      try {
        const data = await getQuestionsByMaterial(materialId);
        setQuestions(data);
      } catch (error) {
        console.error("Error loading questions:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadQuestions();
  }, [materialId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-primary-fixed border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-on-surface-variant font-bold">جاري تحميل الأسئلة...</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
        <span className="material-symbols-outlined text-6xl text-primary/50 mb-4 block">quiz</span>
        <h2 className="text-headline-sm text-on-surface mb-2 font-bold">لا توجد أسئلة بعد</h2>
        <p className="text-body-md text-on-surface-variant mb-8 max-w-[250px]">
          لم يتم توليد أسئلة لهذه المادة بعد. حاول رفع المادة مرة أخرى.
        </p>
        <button
          onClick={() => navigate('/materials')}
          className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm"
        >
          العودة للمواد
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden absolute inset-0 z-50 bg-background">
      <QuizContainer 
        initialQuestions={questions} 
        onComplete={() => navigate('/materials')} 
        onExit={() => navigate('/materials')}
      />
    </div>
  );
}
