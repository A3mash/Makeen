import { useState, useEffect } from 'react';
import { getMaterials, getAllQuestions, getSetting, saveSetting } from '../services/db';
import ActivityHeatmap from '../components/ActivityHeatmap';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [focusTime, setFocusTime] = useState(25);

  useEffect(() => {
    async function loadStats() {
      const materials = await getMaterials();
      const questions = await getAllQuestions();
      const ft = await getSetting('focusTime');
      
      setTotalMaterials(materials.length);
      setTotalQuestions(questions.length);
      if (ft) setFocusTime(ft.value);
    }
    loadStats();
  }, []);

  const handleFocusTimeChange = async (delta: number) => {
    const newTime = Math.max(5, Math.min(120, focusTime + delta));
    setFocusTime(newTime);
    await saveSetting({ id: 'focusTime', value: newTime });
  };

  return (
    <div className="flex flex-col min-h-screen bg-background font-body-md animate-entrance">
      
      {/* Header */}
      <header className="bg-surface-bright/80 backdrop-blur-md shadow-sm sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-4">
          <h1 className="text-headline-md font-bold text-primary">نظرة عامة</h1>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        
        {/* Massive Add Material Banner */}
        <div className="mb-8 relative overflow-hidden bg-primary text-on-primary rounded-3xl p-8 md:p-10 shadow-[0_20px_40px_-15px_rgba(0,32,69,0.2)]">
          <div className="absolute -left-10 -bottom-10 opacity-10">
            <span className="material-symbols-outlined text-[200px]">auto_awesome</span>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-headline-lg font-bold mb-2">مرحباً بك في مَكِين 👋</h2>
              <p className="text-primary-fixed-dim text-title-md max-w-lg">
                هذه خطوتك الأولى لبدء التعلم الذكي. ارفع موادك الدراسية الآن وسنقوم بتنظيمها وتوليد أسئلة مخصصة لك.
              </p>
            </div>
            <Link to="/materials" className="bg-surface text-primary px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:bg-surface-container-highest transition-colors shadow-lg hover:shadow-xl active:scale-95 text-title-md shrink-0">
              <span className="material-symbols-outlined text-[28px]">add_circle</span>
              إضافة مادة جديدة
            </Link>
          </div>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Progress Summary (Spans 8 cols) */}
          <div className="md:col-span-8 bg-surface-container-lowest rounded-2xl p-6 border border-surface-variant shadow-[0_10px_40px_-10px_rgba(0,32,69,0.08)] flex flex-col items-center">
            <h3 className="text-title-md font-bold text-on-surface w-full mb-4">نشاطك الدراسي</h3>
            <div className="w-full overflow-x-auto pb-4 flex justify-center">
              <ActivityHeatmap />
            </div>
          </div>

          {/* Quick Stats (Spans 4 cols) */}
          <div className="md:col-span-4 grid grid-rows-2 gap-6">
            
            {/* Focus Time Card */}
            <div className="bg-surface-container-low text-on-surface rounded-2xl p-6 flex flex-col justify-between border border-surface-variant shadow-[0_10px_40px_-10px_rgba(0,32,69,0.08)]">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-title-md font-bold text-on-surface-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">timer</span>
                  وقت التركيز
                </h4>
              </div>
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => handleFocusTimeChange(-5)}
                  className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center hover:bg-primary-container hover:text-primary transition-colors text-xl font-bold border border-outline-variant"
                >
                  -
                </button>
                <div className="flex items-baseline gap-1">
                  <span className="text-[40px] font-bold leading-none text-primary">{focusTime}</span>
                  <span className="text-body-md text-on-surface-variant font-bold">دقيقة</span>
                </div>
                <button 
                  onClick={() => handleFocusTimeChange(5)}
                  className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center hover:bg-primary-container hover:text-primary transition-colors text-xl font-bold border border-outline-variant"
                >
                  +
                </button>
              </div>
            </div>
            
            {/* Stats Card */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 border border-surface-variant flex flex-col justify-center items-center shadow-[0_10px_40px_-10px_rgba(0,32,69,0.08)]">
              <h4 className="text-body-md text-on-surface-variant mb-4 font-bold">حصيلة دراستك</h4>
              <div className="flex items-center justify-around w-full gap-4">
                <div className="text-center">
                  <span className="text-[36px] font-bold text-primary leading-none block mb-1">{totalMaterials}</span>
                  <span className="text-label-md text-on-surface-variant">مادة دراسية</span>
                </div>
                <div className="w-px h-12 bg-outline-variant/30"></div>
                <div className="text-center">
                  <span className="text-[36px] font-bold text-tertiary leading-none block mb-1">{totalQuestions}</span>
                  <span className="text-label-md text-on-surface-variant">سؤال متاح</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="md:col-span-6 bg-surface-container-lowest rounded-2xl p-6 border border-surface-variant shadow-[0_10px_40px_-10px_rgba(0,32,69,0.08)] flex items-center justify-between hover:border-primary hover:shadow-md transition-all group cursor-pointer" onClick={() => window.location.href = '/review'}>
            <div className="flex items-center gap-4">
              <div className="bg-primary-fixed text-primary p-4 rounded-xl group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[28px]">play_arrow</span>
              </div>
              <div>
                <h3 className="text-title-md font-bold text-on-surface group-hover:text-primary transition-colors">مراجعة شاملة</h3>
                <p className="text-on-surface-variant text-sm mt-1">ابدأ جلسة مراجعة لموادك</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline-variant rtl:rotate-180 group-hover:text-primary transition-colors">arrow_forward_ios</span>
          </div>

          <div className="md:col-span-6 bg-surface-container-lowest rounded-2xl p-6 border border-surface-variant shadow-[0_10px_40px_-10px_rgba(0,32,69,0.08)] flex items-center justify-between hover:border-error hover:shadow-md transition-all group cursor-pointer" onClick={() => window.location.href = '/challenge'}>
            <div className="flex items-center gap-4">
              <div className="bg-error-container text-error p-4 rounded-xl group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[28px]">psychology</span>
              </div>
              <div>
                <h3 className="text-title-md font-bold text-on-surface group-hover:text-error transition-colors">تحدي الفجوات</h3>
                <p className="text-on-surface-variant text-sm mt-1">عالج نقاط الضعف والفجوات</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline-variant rtl:rotate-180 group-hover:text-error transition-colors">arrow_forward_ios</span>
          </div>

        </div>
      </main>
    </div>
  );
}
