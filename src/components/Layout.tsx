import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { name: 'نظرة عامة', path: '/dashboard', icon: 'dashboard' },
    { name: 'المواد', path: '/materials', icon: 'folder_open' },
    { name: 'المراجعة', path: '/review', icon: 'quiz' },
    { name: 'تحدي الفجوات', path: '/challenge', icon: 'psychology' },
    { name: 'الإعدادات', path: '/settings', icon: 'settings' }
  ];

  const hideNavigation = currentPath.startsWith('/quiz') || currentPath.startsWith('/review') || currentPath.startsWith('/edit-material');

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row-reverse text-on-background font-body-md" dir="rtl">
      
      {/* Desktop Sidebar (Right) */}
      {!hideNavigation && (
        <nav className="hidden md:flex flex-col w-64 border-l border-outline-variant bg-surface-container-lowest h-screen sticky top-0 shrink-0">
          <div className="px-6 py-6 border-b border-outline-variant/30 flex items-center justify-center">
            <img src="/logo_horizontal.png" alt="مكين" className="h-14 md:h-16 w-auto object-contain transition-all duration-200" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive 
                    ? 'bg-primary text-on-primary font-bold shadow-md shadow-primary/20' 
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  <span className={`material-symbols-outlined ${isActive ? 'text-on-primary' : 'text-primary'}`}>
                    {item.icon}
                  </span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 overflow-x-hidden relative ${!hideNavigation ? 'pb-24 md:pb-0' : ''}`}>
        {/* Mobile Top Bar (Centered Logo) */}
        {!hideNavigation && (
          <div className="md:hidden bg-surface-container-lowest border-b border-outline-variant/30 px-4 py-3 flex items-center justify-center relative sticky top-0 z-30 shadow-sm h-16">
            <img src="/logo_horizontal.png" alt="مكين" className="h-12 sm:h-14 w-auto object-contain max-h-12" />
            <Link to="/settings" className="absolute left-4 p-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors flex items-center justify-center text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[24px]">settings</span>
            </Link>
          </div>
        )}
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      {!hideNavigation && (
        <nav className="md:hidden fixed bottom-0 w-full bg-surface-container-lowest border-t border-outline-variant pb-safe z-50 shadow-[0px_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex justify-around items-center h-16">
            {navItems.filter(i => i.path !== '/settings').map((item) => {
            const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${
                  isActive ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 w-8 h-1 bg-primary rounded-b-full"></div>
                )}
                <span className={`material-symbols-outlined text-[24px] transition-transform ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}

    </div>
  );
}
