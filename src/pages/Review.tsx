import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMaterials, getQuestionsByMaterial } from '../services/db';
import type { Material, Question } from '../services/db';
import QuizContainer from '../components/QuizContainer';

export default function Review() {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const mats = await getMaterials();
        setMaterials(mats);
        // By default, select all materials
        setSelectedMaterialIds(new Set(mats.map(m => m.id)));
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const handleStartReview = async () => {
    if (selectedMaterialIds.size === 0) {
      alert("يرجى تحديد مادة واحدة على الأقل");
      return;
    }
    
    setIsLoading(true);
    try {
      let allQuestions: Question[] = [];
      for (const id of selectedMaterialIds) {
        const qs = await getQuestionsByMaterial(id);
        allQuestions = [...allQuestions, ...qs];
      }
      
      if (allQuestions.length === 0) {
        alert("لم يتم العثور على أسئلة للمواد المحددة.");
        setIsLoading(false);
        return;
      }
      
      // Shuffle and pick 20 maximum for a review session
      const shuffled = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 20);
      setQuestions(shuffled);
      setIsStarted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMaterial = (id: string) => {
    const next = new Set(selectedMaterialIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMaterialIds(next);
  };

  const toggleTopic = (topicMaterials: Material[]) => {
    const next = new Set(selectedMaterialIds);
    const allSelected = topicMaterials.every(m => next.has(m.id));
    if (allSelected) {
      topicMaterials.forEach(m => next.delete(m.id));
    } else {
      topicMaterials.forEach(m => next.add(m.id));
    }
    setSelectedMaterialIds(next);
  };

  // Group materials by topic
  const groupedMaterials = materials.reduce((acc, material) => {
    const topic = material.topic || 'عام';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(material);
    return acc;
  }, {} as Record<string, Material[]>);

  if (isLoading && !isStarted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background h-screen">
        <div className="w-10 h-10 border-4 border-primary-fixed border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-on-surface-variant font-bold">جاري التحميل...</p>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-background h-screen">
        <span className="material-symbols-outlined text-6xl text-primary/50 mb-4 block">quiz</span>
        <h2 className="text-headline-sm text-on-surface mb-2 font-bold">لا توجد أسئلة للمراجعة</h2>
        <p className="text-body-md text-on-surface-variant mb-8 max-w-[250px]">
          ارفع مادة دراسية أولاً ليتم توليد أسئلة للمراجعة.
        </p>
        <button
          onClick={() => navigate('/materials')}
          className="bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:bg-primary-container transition-colors shadow-sm"
        >
          العودة للمواد
        </button>
      </div>
    );
  }

  if (!isStarted) {
    return (
      <div className="flex flex-col h-full bg-background font-body-md animate-entrance pb-24">
        {/* Header */}
        <header className="bg-surface-container-lowest/80 backdrop-blur-md shadow-sm sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-outline-variant/30">
          <div className="flex items-center gap-4">
            <h1 className="font-title-md text-title-md text-on-surface font-bold">المراجعة الشاملة</h1>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant flex flex-col mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-3xl">checklist</span>
              </div>
              <div>
                <h2 className="text-headline-sm font-bold text-on-surface">حدد نطاق المراجعة</h2>
                <p className="text-body-md text-on-surface-variant">
                  اختر المواد التي ترغب في تضمينها في جلسة المراجعة الحالية.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedMaterials).map(([topic, topicMaterials]) => {
              const allSelected = topicMaterials.every(m => selectedMaterialIds.has(m.id));
              
              return (
                <div key={topic} className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
                  {/* Topic Header */}
                  <div 
                    className="bg-surface-container-low px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-surface-container-high transition-colors"
                    onClick={() => toggleTopic(topicMaterials)}
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded border border-primary text-primary shrink-0 transition-colors">
                      {allSelected ? <span className="material-symbols-outlined text-[18px]">check</span> : <span className="w-4 h-4 rounded bg-transparent"></span>}
                    </div>
                    <span className="material-symbols-outlined text-primary">folder</span>
                    <h3 className="font-bold text-title-md flex-1 text-on-surface">{topic}</h3>
                  </div>

                  {/* Materials List */}
                  <div className="flex flex-col">
                    {topicMaterials.map(m => {
                      const isSelected = selectedMaterialIds.has(m.id);
                      return (
                        <div 
                          key={m.id} 
                          className="px-4 py-3 border-t border-outline-variant/30 flex items-center gap-3 cursor-pointer hover:bg-surface-container-highest transition-colors pl-10"
                          onClick={() => toggleMaterial(m.id)}
                        >
                          <div className="ml-2 w-6 h-6 flex items-center justify-center shrink-0">
                            {isSelected ? (
                              <div className="w-5 h-5 rounded bg-primary text-on-primary flex items-center justify-center">
                                <span className="material-symbols-outlined text-[16px]">check</span>
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded border border-outline-variant"></div>
                            )}
                          </div>
                          <span className="text-on-surface flex-1 truncate">{m.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 flex justify-end sticky bottom-6 z-10">
            <button
              onClick={handleStartReview}
              disabled={selectedMaterialIds.size === 0}
              className="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg active:scale-95 text-lg w-full md:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              بدء الاختبار ({selectedMaterialIds.size} مادة)
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden absolute inset-0 z-50 bg-background">
      <QuizContainer 
        initialQuestions={questions} 
        onComplete={() => setIsStarted(false)} 
        onExit={() => setIsStarted(false)}
      />
    </div>
  );
}
