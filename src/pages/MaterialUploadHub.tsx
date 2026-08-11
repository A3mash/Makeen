import React, { useState, useRef, useEffect } from 'react';
import { getMaterials, saveMaterial, deleteMaterialData, bulkSaveQuestions, saveMaterialFile } from '../services/db';
import type { Material, Question } from '../services/db';
import { extractTextFromFile } from '../utils/fileExtractor';
import { splitTextIntoChunks } from '../utils/textSplitter';
import { generateQuizFromText, generateMaterialMetadata } from '../services/aiService';
import { useNavigate } from 'react-router-dom';

export default function MaterialUploadHub() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [toastNotification, setToastNotification] = useState<{ message: string; materialId?: string } | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadMaterials() {
      try {
        const data = await getMaterials();
        setMaterials(data.sort((a, b) => b.uploadDate - a.uploadDate));
      } catch (error) {
        console.error("Error loading materials:", error);
      }
    }
    loadMaterials();
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const closeMenus = () => setActiveMenuId(null);
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const processText = async (text: string, originalName: string, source: string, type: 'PDF' | 'YouTube' | 'PPT' | 'Text', originalFile?: File) => {
    setIsUploading(true);
    setUploadProgress(null);
    try {
      setUploadStatus('جاري تحليل المحتوى لتصنيف المادة...');
      const metadata = await generateMaterialMetadata(text);
      
      const newMaterial: Material = {
        id: crypto.randomUUID(),
        title: metadata.title || originalName,
        topic: metadata.topic || 'عام',
        type,
        source,
        uploadDate: Date.now(),
      };

      setUploadStatus('جاري تقطيع النص...');
      const chunks = splitTextIntoChunks(text, 4000, 0.15);
      
      setUploadStatus('جاري توليد الأسئلة عبر الذكاء الاصطناعي...');
      setUploadProgress({ current: 0, total: chunks.length });
      
      let allQuestions: Question[] = [];

      for (let i = 0; i < chunks.length; i++) {
         if (i > 0) {
           await new Promise(r => setTimeout(r, 4000)); // 4-second delay to respect 15 RPM limit
         }
         
         const chunk = chunks[i];
         if (chunk.trim().length > 50) {
           setUploadStatus(`جاري تحليل الجزء ${i + 1} من ${chunks.length}...`);
           const generatedQs = await generateQuizFromText(chunk, newMaterial.id);
           allQuestions = [...allQuestions, ...generatedQs];
         }
         setUploadProgress({ current: i + 1, total: chunks.length });
      }

      setUploadStatus('جاري الحفظ محلياً...');
      setUploadProgress(null);
      await saveMaterial(newMaterial);
      
      if (originalFile && type === 'PDF') {
        // We import saveMaterialFile dynamically or add it to the top imports
        await saveMaterialFile(newMaterial.id, originalFile);
      }
      
      if (allQuestions.length > 0) {
        await bulkSaveQuestions(allQuestions);
      }

      setMaterials(prev => [newMaterial, ...prev]);
      setToastNotification({
        message: `تم إضافة المادة "${newMaterial.title}" في مجلد "${newMaterial.topic}" بنجاح وتوليد ${allQuestions.length} سؤال.`,
        materialId: newMaterial.id
      });
      setPastedText('');
    } catch (error: any) {
      console.error("Upload Error:", error);
      alert(`حدث خطأ أثناء رفع وتحليل المادة: ${error.message || error}`);
    } finally {
      setIsUploading(false);
      setUploadStatus('');
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedText.trim()) return;
    
    await processText(pastedText, "محتوى نصي ملصق", "نص مباشر", 'Text');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus('جاري استخراج النص...');

    try {
      let type: 'PDF' | 'Text' = 'Text';
      if (file.name.endsWith('.pdf')) type = 'PDF';

      const textContent = await extractTextFromFile(file);
      await processText(textContent, file.name, file.name, type, file);
    } catch (error: any) {
      console.error("Extraction error:", error);
      alert(`حدث خطأ أثناء قراءة الملف: ${error.message || error}`);
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleDeleteMaterial = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("هل أنت متأكد من حذف هذه المادة؟ سيتم حذف جميع أسئلتها وإحصائياتها.")) {
      await deleteMaterialData(id);
      setMaterials(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleEditMaterial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/edit-material/${id}`);
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'PDF': return 'picture_as_pdf';
      case 'Text': return 'notes';
      default: return 'description';
    }
  };

  const getMaterialIconBg = (type: string) => {
    switch (type) {
      case 'PDF': return 'bg-secondary-container/20 text-secondary-container';
      case 'Text': return 'bg-primary-container/20 text-primary-container';
      default: return 'bg-tertiary-container/20 text-tertiary-container';
    }
  };

  // Group materials by topic
  const groupedMaterials = materials.reduce((acc, material) => {
    const topic = material.topic || 'عام';
    if (!acc[topic]) acc[topic] = [];
    acc[topic].push(material);
    return acc;
  }, {} as Record<string, Material[]>);

  return (
    <div className="flex flex-col h-full bg-background font-body-md animate-entrance relative">
      
      {/* Header with Back Button */}
      <header className="bg-surface-container-lowest/80 backdrop-blur-md shadow-sm sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b border-outline-variant/30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 -mr-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors flex items-center justify-center text-on-surface"
            aria-label="العودة"
          >
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <h1 className="font-title-md text-title-md text-on-surface font-bold">المواد الدراسية</h1>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-8">
        
        <section>
          <p className="text-on-surface-variant font-body-md">ارفع وأدر مصادرك الدراسية. سيقوم الذكاء الاصطناعي بتصنيفها وتوليد أسئلة منها.</p>
        </section>

        {/* Upload Area */}
        <section 
          onClick={!isUploading ? handleUploadClick : undefined}
          className={`bg-surface-container-lowest rounded-2xl border-2 border-dashed border-outline-variant p-8 flex flex-col items-center justify-center text-center gap-4 transition-colors shadow-sm relative ${isUploading ? 'opacity-90' : 'hover:bg-surface-container-high cursor-pointer hover:border-primary/50'}`}>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".pdf,.txt,.md,.csv,.json" 
            disabled={isUploading}
          />

          <div className="w-16 h-16 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm">
            {isUploading ? (
              <span className="material-symbols-outlined text-3xl animate-spin">sync</span>
            ) : (
              <span className="material-symbols-outlined text-3xl">cloud_upload</span>
            )}
          </div>
          <div className="w-full max-w-sm mx-auto">
            <h3 className="font-title-md text-title-md text-on-surface mb-1 font-bold">
              {isUploading ? uploadStatus : 'اضغط لرفع ملف'}
            </h3>
            {!isUploading && <p className="text-on-surface-variant font-label-md text-label-md">الصيغ المدعومة لنموذج جيميناي: PDF, TXT, MD, CSV</p>}
            
            {/* Progress Bar */}
            {isUploading && uploadProgress && (
              <div className="mt-4 flex flex-col gap-2 w-full animate-entrance">
                <div className="flex justify-between text-xs text-on-surface-variant font-bold">
                  <span>المعالجة:</span>
                  <span>{uploadProgress.current} من {uploadProgress.total}</span>
                </div>
                <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden border border-outline-variant/50">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-300" 
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Text Paste Input */}
        <form onSubmit={handleTextSubmit} className="flex flex-col gap-2 w-full">
          <textarea
            placeholder="أو قم بلصق أي نص هنا مباشرة (مقال، تفريغ فيديو، محتوى دراسي) مهما كان طوله..."
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md shadow-sm resize-y min-h-[120px]"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={isUploading}
            required
          />
          <button
            type="submit"
            disabled={isUploading || !pastedText.trim()}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-50 shadow-sm self-end"
          >
            تحليل النص وتوليد الأسئلة
          </button>
        </form>

        {/* Grouped Materials List */}
        <section className="flex flex-col gap-8 pb-8">
          {materials.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center bg-surface-container-lowest rounded-2xl border border-dashed border-outline-variant">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4">folder_off</span>
              <p className="text-on-surface font-bold text-lg mb-1">لا توجد مواد مضافة بعد</p>
              <p className="text-on-surface-variant text-sm">ارفع ملفاً أو أضف رابط يوتيوب للبدء</p>
            </div>
          ) : (
            Object.entries(groupedMaterials).map(([topic, topicMaterials]) => (
              <div key={topic} className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-primary">folder</span>
                  <h2 className="font-title-md text-title-md text-on-surface font-bold">{topic}</h2>
                  <span className="bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-full text-xs">{topicMaterials.length}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topicMaterials.map(material => (
                    <article 
                      key={material.id} 
                      onClick={() => navigate(`/quiz/${material.id}`)}
                      className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant flex items-center gap-4 group cursor-pointer hover:border-primary hover:shadow-md transition-all active:scale-[0.98] relative"
                    >
                      <div className={`w-12 h-12 rounded-lg ${getMaterialIconBg(material.type)} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                        <span className="material-symbols-outlined">{getMaterialIcon(material.type)}</span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <h4 className="font-title-md text-[16px] text-on-surface font-bold truncate group-hover:text-primary transition-colors">{material.title}</h4>
                        <p className="text-on-surface-variant font-label-sm text-label-sm mt-1">
                          الرفع: {new Date(material.uploadDate).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                      <div className="shrink-0 relative">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setActiveMenuId(activeMenuId === material.id ? null : material.id); 
                          }} 
                          aria-label="خيارات إضافية" 
                          className="text-on-surface-variant p-2 rounded-full hover:bg-surface-container-high focus:outline-none"
                        >
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenuId === material.id && (
                          <div className="absolute left-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant overflow-hidden z-20 animate-entrance">
                            <button 
                              onClick={(e) => handleEditMaterial(material.id, e)}
                              className="w-full text-right px-4 py-3 hover:bg-surface-container-low transition-colors flex items-center gap-2 text-on-surface"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                              تعديل المادة
                            </button>
                            <button 
                              onClick={(e) => handleDeleteMaterial(material.id, e)}
                              className="w-full text-right px-4 py-3 hover:bg-error-container hover:text-on-error-container transition-colors flex items-center gap-2 text-error"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                              حذف المادة
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {/* Success Modal */}
      {toastNotification && (
        <div className="fixed inset-0 z-[100] bg-on-background/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest border border-primary shadow-[0_10px_40px_-10px_rgba(0,32,69,0.2)] rounded-2xl p-8 flex flex-col items-center text-center gap-6 max-w-md w-full animate-entrance">
            <div className="w-20 h-20 rounded-full bg-primary-container text-primary flex items-center justify-center mb-2">
              <span className="material-symbols-outlined text-[48px]">task_alt</span>
            </div>
            
            <h3 className="font-headline-sm font-bold text-on-surface">اكتملت المعالجة بنجاح!</h3>
            <p className="text-body-lg text-on-surface-variant font-medium leading-relaxed">
              {toastNotification.message}
            </p>
            
            <div className="flex flex-col gap-3 w-full mt-4">
              <button 
                onClick={() => navigate(`/quiz/${toastNotification.materialId}`)}
                className="w-full bg-primary text-on-primary py-4 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm text-lg flex justify-center items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                بدء الاختبار الآن
              </button>
              <button 
                onClick={() => setToastNotification(null)}
                className="w-full bg-surface-container-high border border-outline-variant text-on-surface py-3 rounded-xl font-bold hover:bg-surface-container-highest transition-colors"
              >
                إغلاق والبقاء هنا
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
