import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuestionsByMaterial, deleteQuestion, addQuestion, updateQuestion } from '../services/db';
import type { Question } from '../services/db';

function QuestionEditorCard({ 
  question, 
  index,
  onDelete 
}: { 
  question: Question; 
  index: number;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState<Question>(question);
  const [isSaving, setIsSaving] = useState(false);

  // Sync internal state if props change (unlikely unless new list loaded, but good practice)
  useEffect(() => { setQ(question); }, [question]);

  const saveToDb = async (updatedQ: Question) => {
    setIsSaving(true);
    await updateQuestion(updatedQ);
    setIsSaving(false);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQ(prev => ({ ...prev, text: val }));
  };

  const handleOptionChange = (optIndex: number, val: string) => {
    setQ(prev => {
      const newOpts = [...prev.options];
      const oldVal = newOpts[optIndex];
      newOpts[optIndex] = val;
      
      // If this option was the correct answer, update correctAnswer as well
      let newCorrect = prev.correctAnswer;
      if (prev.correctAnswer === oldVal) {
        newCorrect = val;
      }
      
      return { ...prev, options: newOpts, correctAnswer: newCorrect };
    });
  };

  const handleCorrectSelect = (val: string) => {
    setQ(prev => ({ ...prev, correctAnswer: val }));
    saveToDb({ ...q, correctAnswer: val }); // immediately save radio change
  };

  const handleRationaleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQ(prev => ({ ...prev, rationale: e.target.value }));
  };

  const handleBlur = () => {
    // Only save if options are valid (at least 2 non-empty)
    const validOpts = q.options.filter(o => o.trim() !== '');
    if (validOpts.length >= 2 && q.text.trim() !== '') {
      saveToDb(q);
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant flex flex-col gap-4 relative">
      {isSaving && (
        <div className="absolute top-4 left-4 text-primary animate-pulse">
          <span className="material-symbols-outlined text-sm">sync</span>
        </div>
      )}
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <label className="text-label-sm text-on-surface-variant font-bold mb-1 block">السؤال {index + 1}</label>
          <textarea 
            value={q.text}
            onChange={handleTextChange}
            onBlur={handleBlur}
            className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 focus:outline-none focus:border-primary font-bold text-on-surface resize-none"
            rows={2}
            placeholder="نص السؤال..."
          />
        </div>
        <button 
          onClick={() => onDelete(q.id)} 
          className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-lg hover:bg-error-container/20 mt-6"
          title="حذف السؤال"
        >
          <span className="material-symbols-outlined">delete</span>
        </button>
      </div>
      
      <div>
        <label className="text-label-sm text-on-surface-variant font-bold mb-2 block">الخيارات (اختر الإجابة الصحيحة)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map(i => {
            const optVal = q.options[i] || '';
            const isCorrect = q.correctAnswer === optVal && optVal.trim() !== '';
            
            return (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-xl border transition-colors ${isCorrect ? 'border-primary bg-primary-fixed/20' : 'border-outline-variant/50 bg-surface-container-low'}`}>
                <input 
                  type="radio" 
                  name={`correct-${q.id}`} 
                  checked={isCorrect}
                  onChange={() => optVal.trim() !== '' && handleCorrectSelect(optVal)}
                  className="w-4 h-4 text-primary focus:ring-primary shrink-0 cursor-pointer"
                  disabled={optVal.trim() === ''}
                />
                <input 
                  type="text"
                  value={optVal}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  onBlur={handleBlur}
                  placeholder={`الخيار ${i + 1}`}
                  className="flex-1 bg-transparent border-none focus:outline-none text-sm text-on-surface w-full min-w-0"
                />
              </div>
            );
          })}
        </div>
      </div>
      
      <div>
        <label className="text-label-sm text-on-surface-variant font-bold mb-1 block">التعليل (يظهر عند الإجابة الخاطئة)</label>
        <textarea 
          value={q.rationale || ''}
          onChange={handleRationaleChange}
          onBlur={handleBlur}
          className="w-full bg-secondary-container/10 border border-secondary/20 rounded-xl p-3 focus:outline-none focus:border-secondary text-sm text-on-surface-variant resize-none"
          rows={2}
          placeholder="أضف شرحاً أو تعليلاً للإجابة الصحيحة..."
        />
      </div>
    </div>
  );
}


export default function EditMaterial() {
  const { materialId } = useParams<{ materialId: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadQuestions = async () => {
    if (!materialId) return;
    try {
      const data = await getQuestionsByMaterial(materialId);
      setQuestions(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [materialId]);

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السؤال؟')) {
      await deleteQuestion(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  const handleAddNew = async () => {
    if (!materialId) return;
    const newQ: Question = {
      id: crypto.randomUUID(),
      materialId: materialId,
      text: '',
      options: ['', '', '', ''],
      correctAnswer: ''
    };
    await addQuestion(newQ);
    setQuestions(prev => [newQ, ...prev]);
    
    // Scroll to top to see the new question
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-background">
        <span className="material-symbols-outlined text-4xl animate-spin text-primary">sync</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background font-body-md animate-entrance relative pb-24">
      {/* Header */}
      <header className="bg-surface-container-lowest/80 backdrop-blur-md shadow-sm sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/materials')}
            className="p-2 -mr-2 rounded-full hover:bg-black/5 transition-colors flex items-center justify-center text-on-surface"
            aria-label="العودة"
          >
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <h1 className="font-title-md text-title-md text-on-surface font-bold">تعديل أسئلة المادة</h1>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-primary/90 transition-colors shadow-sm active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          إضافة سؤال جديد
        </button>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
        <div className="bg-surface-container-low text-on-surface-variant p-4 rounded-xl text-sm flex items-center gap-3 border border-outline-variant/50">
          <span className="material-symbols-outlined text-primary">info</span>
          <p>التغييرات تُحفظ تلقائياً بمجرد الانتهاء من الكتابة والخروج من الحقل. حدد الإجابة الصحيحة بالضغط على الدائرة بجانب الخيار.</p>
        </div>

        {questions.length === 0 ? (
          <div className="text-center p-12 text-on-surface-variant bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant flex flex-col items-center gap-4">
            <span className="material-symbols-outlined text-4xl opacity-50">quiz</span>
            <p>لا توجد أسئلة هنا. قم بإضافة سؤال جديد للبدء.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {questions.map((q, idx) => (
              <QuestionEditorCard 
                key={q.id} 
                question={q} 
                index={idx}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
