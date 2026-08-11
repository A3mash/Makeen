import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { getSetting, saveSetting, importBackupData, exportBackupData } from '../services/db';

export default function Settings() {
  const [focusTime, setFocusTime] = useState<number>(25);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      const ftSetting = await getSetting('focusTime');
      if (ftSetting) {
        setFocusTime(ftSetting.value);
      }
    }
    loadSettings();
  }, []);

  const handleSaveFocusTime = async () => {
    await saveSetting({ id: 'focusTime', value: focusTime });
    alert('تم حفظ وقت التركيز بنجاح!');
  };

  const handleExport = async () => {
    try {
      const dataStr = await exportBackupData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `makeen_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
      alert('فشل تصدير البيانات.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importBackupData(text);
      alert('تم استعادة البيانات بنجاح! سيتم إعادة تحميل التطبيق لضمان استقرار البيانات.');
      window.location.href = '/';
    } catch (error) {
      console.error("Import failed:", error);
      alert('فشل استيراد البيانات. تأكد من صحة الملف.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background font-body-md animate-entrance">
      {/* Header with Back Button */}
      <header className="bg-surface-container-lowest/80 backdrop-blur-md shadow-sm sticky top-0 z-40 px-6 py-4 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => window.history.back()}
            className="p-2 -mr-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors flex items-center justify-center text-on-surface"
            aria-label="العودة"
          >
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <h1 className="font-title-md text-title-md text-on-surface font-bold">الإعدادات</h1>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-8">
        
        {/* Focus Time Setting */}
        <section className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-primary-container text-on-primary-container p-2 rounded-lg">
              <span className="material-symbols-outlined">timer</span>
            </div>
            <h2 className="font-title-md text-title-md text-on-surface font-bold">وقت التركيز</h2>
          </div>
          <p className="text-on-surface-variant mb-6 text-sm">حدد المدة الزمنية المفضلة لجلسات التركيز الخاصة بك (بالدقائق).</p>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <input 
                type="number" 
                min="5" 
                max="120" 
                value={focusTime}
                onChange={(e) => setFocusTime(parseInt(e.target.value) || 25)}
                className="w-full bg-surface-container-low border border-outline-variant text-on-surface rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
              <span className="absolute left-4 top-3 text-on-surface-variant">دقيقة</span>
            </div>
            <button 
              onClick={handleSaveFocusTime}
              className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold shadow-md hover:bg-primary/90 transition-colors active:scale-95 whitespace-nowrap"
            >
              حفظ الإعدادات
            </button>
          </div>
        </section>

        {/* Data Flexibility (Import/Export) */}
        <section className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-secondary-container text-on-secondary-container p-2 rounded-lg">
              <span className="material-symbols-outlined">database</span>
            </div>
            <h2 className="font-title-md text-title-md text-on-surface font-bold">مرونة البيانات</h2>
          </div>
          <p className="text-on-surface-variant mb-6 text-sm">
            قم بأخذ نسخة احتياطية من موادك وإجاباتك أو استعادتها. هذه البيانات تحفظ محلياً على متصفحك.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={handleExport}
              className="flex items-center justify-center gap-2 border border-outline-variant text-on-surface bg-surface hover:bg-surface-container-high px-6 py-4 rounded-xl font-bold transition-colors shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined">download</span>
              تصدير نسخة احتياطية
            </button>

            <button 
              onClick={handleImportClick}
              className="flex items-center justify-center gap-2 border border-outline-variant text-primary bg-primary-fixed/20 hover:bg-primary-fixed/40 px-6 py-4 rounded-xl font-bold transition-colors shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined">upload</span>
              استعادة نسخة احتياطية
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportChange}
              className="hidden"
            />
          </div>
        </section>

        {/* App Info / Branding */}
        <section className="flex flex-col items-center justify-center p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 text-center gap-3 shadow-sm">
          <img src="/logo_stacked.png" alt="مكين" className="h-36 sm:h-44 w-auto object-contain transition-all" />
          <div className="text-xs text-on-surface-variant/50 font-mono mt-1">
            الإصدار 1.0.0
          </div>
        </section>
        
      </main>
    </div>
  );
}
