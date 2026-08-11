import React, { useState, useRef, useEffect } from 'react';
import { saveMaterial, getMaterials, bulkSaveQuestions, deleteMaterialData } from '../services/db';
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
  const [youtubeLink, setYoutubeLink] = useState<string>('');
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

  const processText = async (text: string, originalName: string, source: string, type: 'PDF' | 'YouTube' | 'PPT') => {
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
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < chunks.length; i++) {
         const chunk = chunks[i];
         if (chunk.trim().length > 50) {
           const generatedQs = await generateQuizFromText(chunk, newMaterial.id);
           allQuestions = [...allQuestions, ...generatedQs];
           // Delay to prevent HTTP 429 Too Many Requests
           await sleep(2500);
         }
         setUploadProgress({ current: i + 1, total: chunks.length });
      }

      setUploadStatus('جاري الحفظ محلياً...');
      setUploadProgress(null);
      await saveMaterial(newMaterial);
      
      if (allQuestions.length > 0) {
        await bulkSaveQuestions(allQuestions);
      }

      setMaterials(prev => [newMaterial, ...prev]);
      setToastNotification({
        message: `تم إضافة المادة "${newMaterial.title}" في مجلد "${newMaterial.topic}" بنجاح وتوليد ${allQuestions.length} سؤال.`,
        materialId: newMaterial.id
      });
      setYoutubeLink('');
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

  const handleYoutubeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeLink) return;
    setIsUploading(true);
    setUploadStatus('جاري جلب تفريغ الفيديو من يوتيوب...');
    
    try {
      const response = await fetch(`/api/youtube-transcript?url=${encodeURIComponent(youtubeLink)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'فشل جلب تفريغ الفيديو. قد لا يحتوي الفيديو على ترجمة.');
      }
      
      const data = await response.json();
      if (!data.transcript) {
         throw new Error('لم يتم العثور على تفريغ نصي في الرد.');
      }
      
      // Process the fetched transcript (splits it into chunks and generates questions)
      await processText(data.transcript, "فيديو يوتيوب", youtubeLink, 'YouTube');
    } catch (error: any) {
      console.error("YouTube Fetch Error:", error);
      alert(`حدث خطأ: ${error.message || error}`);
      setIsUploading(false);
      setUploadStatus('');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setUploadStatus('جاري استخراج النص...');

    try {
      let type: 'PDF' | 'PPT' | 'YouTube' = 'YouTube';
      if (file.name.endsWith('.pdf')) type = 'PDF';
      else if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) type = 'PPT';

      const textContent = await extractTextFromFile(file);
      await processText(textContent, file.name, file.name, type);
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
      case 'PPT': return 'co_present';
      default: return 'play_circle';
    }
  };

  const getMaterialIconBg = (type: string) => {
    switch (type) {
      case 'PDF': return 'bg-secondary-container/20 text-secondary-container';
      case 'PPT': return 'bg-tertiary-container/20 text-tertiary-container';
      default: return 'bg-primary-container/20 text-primary-container';
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
            accept=".pdf,.ppt,.pptx" 
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
              {isUploading ? uploadStatus : 'اضغط لرفع ملف (PDF, PPT)'}
            </h3>
            {!isUploading && <p className="text-on-surface-variant font-label-md text-label-md">الحد الأقصى 50MB</p>}
            
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

        {/* YouTube Link Input */}
        <form onSubmit={handleYoutubeSubmit} className="flex gap-2 w-full">
          <input
            type="url"
            placeholder="أو ضع رابط فيديو يوتيوب هنا..."
            className="flex-grow bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all font-body-md shadow-sm"
            value={youtubeLink}
            onChange={(e) => setYoutubeLink(e.target.value)}
            disabled={isUploading}
            required
          />
          <button
            type="submit"
            disabled={isUploading}
            className="bg-primary text-on-primary px-6 py-3 rounded-xl font-bold hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-50 shadow-sm whitespace-nowrap"
          >
            إضافة الرابط
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

      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-entrance w-full max-w-sm px-4">
          <div className="bg-surface-container-lowest border border-primary shadow-[0_10px_40px_-10px_rgba(0,32,69,0.2)] rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3 text-primary">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
              <p className="font-bold text-on-surface mt-1">{toastNotification.message}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => navigate(`/quiz/${toastNotification.materialId}`)}
                className="flex-1 bg-primary text-on-primary py-2 rounded-xl font-bold hover:bg-primary/90 transition-colors"
              >
                بدء الاختبار
              </button>
              <button 
                onClick={() => setToastNotification(null)}
                className="flex-1 bg-surface-container-high text-on-surface py-2 rounded-xl font-bold hover:bg-surface-container-highest transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
