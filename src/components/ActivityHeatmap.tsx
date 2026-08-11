import { useEffect, useState } from 'react';
import { getActivityLogs } from '../services/db';

interface DayData {
  dateString: string;
  count: number;
  studyTimeSeconds: number;
}

export default function ActivityHeatmap() {
  const [logs, setLogs] = useState<Map<string, { count: number; studyTime: number }>>(new Map());
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      const dbLogs = await getActivityLogs();
      const logMap = new Map<string, { count: number; studyTime: number }>();
      dbLogs.forEach(log => {
        logMap.set(log.dateString, {
          count: log.questionsAnswered,
          studyTime: log.studyTimeSeconds || 0
        });
      });
      setLogs(logMap);
    }
    fetchLogs();
  }, []);

  // Generate last 90 days grid
  const days: DayData[] = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateString = d.toISOString().split('T')[0];
    const data = logs.get(dateString);
    days.push({ 
      dateString, 
      count: data?.count || 0,
      studyTimeSeconds: data?.studyTime || 0
    });
  }

  // Group by month for display
  const months: { name: string; colSpan: number }[] = [];
  let currentMonth = '';
  let currentMonthCount = 0;
  
  days.forEach((day, index) => {
    const monthName = new Date(day.dateString).toLocaleString('ar-EG', { month: 'short' });
    if (monthName !== currentMonth) {
      if (currentMonth) {
        months.push({ name: currentMonth, colSpan: currentMonthCount });
      }
      currentMonth = monthName;
      currentMonthCount = 1;
    } else {
      currentMonthCount++;
    }
    // if last day
    if (index === days.length - 1) {
      months.push({ name: currentMonth, colSpan: currentMonthCount });
    }
  });

  const getColor = (count: number) => {
    if (count === 0) return 'bg-surface-container-high border-outline-variant/30';
    if (count < 5) return 'bg-primary-fixed-dim/50 border-primary-fixed-dim';
    if (count < 15) return 'bg-primary-fixed border-primary-fixed';
    if (count < 30) return 'bg-primary border-primary';
    return 'bg-on-primary-fixed-variant border-on-primary-fixed-variant'; // very active
  };

  const formatStudyTime = (seconds: number) => {
    if (seconds < 60) return `${seconds} ثانية`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} دقيقة`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMins = (minutes % 60).toString().padStart(2, '0');
    return `${hours}:${remainingMins} ساعة`;
  };

  return (
    <div className="relative w-full flex flex-col items-center">
      
      <div className="overflow-x-auto w-full custom-scrollbar pb-4 flex justify-center">
        <div className="w-max">
          {/* Month Labels */}
          <div className="flex text-label-sm text-on-surface-variant mb-2 w-full">
            {months.map((m, i) => (
              <div key={i} style={{ width: `${(m.colSpan / 90) * 100}%` }} className="text-right truncate px-1 text-[11px] font-medium text-on-surface-variant/70">
                {m.name}
              </div>
            ))}
          </div>

          {/* Heatmap Grid */}
          <div className="flex flex-col gap-1.5 w-max relative mt-2">
            <div className="flex flex-wrap flex-col h-[130px] content-start gap-1.5">
              {days.map((day, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(day)}
                  className={`w-4 h-4 rounded-[3px] border ${getColor(day.count)} transition-all hover:scale-125 cursor-pointer relative group`}
                >
                  {/* Tooltip on hover for quick viewing */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-on-surface text-surface text-xs px-2 py-1 rounded pointer-events-none whitespace-nowrap z-10 transition-opacity">
                    {day.dateString}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center w-full gap-3 text-label-md font-medium text-on-surface-variant">
        <span>أقل</span>
        <div className="w-4 h-4 rounded-[3px] bg-surface-container-high border border-outline-variant/30"></div>
        <div className="w-4 h-4 rounded-[3px] bg-primary-fixed-dim/50 border border-primary-fixed-dim"></div>
        <div className="w-4 h-4 rounded-[3px] bg-primary border border-primary"></div>
        <div className="w-4 h-4 rounded-[3px] bg-on-primary-fixed-variant border border-on-primary-fixed-variant"></div>
        <span>أكثر</span>
      </div>

      {/* Detailed Modal on Click */}
      {selectedDay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-sm rounded-2xl p-4 animate-entrance">
          <div className="bg-surface border border-outline-variant shadow-lg rounded-xl p-6 max-w-sm w-full">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-title-md text-on-surface">نشاط يوم {selectedDay.dateString}</h4>
              <button 
                onClick={() => setSelectedDay(null)}
                className="text-on-surface-variant hover:text-error transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-tertiary">quiz</span>
                  <span className="text-on-surface font-medium">الأسئلة المحلولة</span>
                </div>
                <span className="font-bold text-title-md">{selectedDay.count}</span>
              </div>
              
              <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">timer</span>
                  <span className="text-on-surface font-medium">وقت الدراسة</span>
                </div>
                <span className="font-bold text-title-md">{formatStudyTime(selectedDay.studyTimeSeconds)}</span>
              </div>
            </div>
            
            {selectedDay.count === 0 && (
              <p className="text-center text-label-sm text-on-surface-variant mt-4">
                لم تقم بالدراسة في هذا اليوم. يمكنك التعويض غداً!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
