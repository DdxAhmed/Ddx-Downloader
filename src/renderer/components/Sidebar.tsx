import React from 'react';
import {
  Home,
  Download,
  ListVideo,
  Film,
  History,
  Settings,
  ShieldCheck,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { SupportedLanguage, getTranslation } from '../i18n';

export type NavTab = 'home' | 'downloads' | 'playlists' | 'converter' | 'library' | 'history' | 'settings';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeDownloadsCount: number;
  lang: SupportedLanguage;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeDownloadsCount,
  lang,
}) => {
  const isAr = lang === 'ar';

  const navItems = [
    { id: 'home' as NavTab, label: getTranslation('navHome', lang), icon: Home },
    {
      id: 'downloads' as NavTab,
      label: getTranslation('navDownloads', lang),
      icon: Download,
      badge: activeDownloadsCount > 0 ? activeDownloadsCount : undefined,
    },
    { id: 'playlists' as NavTab, label: getTranslation('navPlaylists', lang), icon: ListVideo },
    { id: 'converter' as NavTab, label: getTranslation('navConverter', lang), icon: RefreshCw },
    { id: 'library' as NavTab, label: getTranslation('navLibrary', lang), icon: Film },
    { id: 'history' as NavTab, label: getTranslation('navHistory', lang), icon: History },
    { id: 'settings' as NavTab, label: getTranslation('navSettings', lang), icon: Settings },
  ];

  return (
    <aside className="w-64 h-screen bg-[#0d1322] border-r border-slate-800/80 flex flex-col justify-between select-none shrink-0">
      {/* Brand Header */}
      <div>
        <div className="p-5 flex items-center gap-3 border-b border-slate-800/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
              Ddx <span className="text-indigo-400 font-light text-base">Downloader</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              {isAr ? 'منصة تنزيل ومعالجة الوسائط' : 'Local-First Media Suite'}
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-400 text-slate-950 animate-pulse font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Local-First Guarantee Footer */}
      <div className="p-4 border-t border-slate-800/60 m-3 rounded-xl bg-slate-900/40 border">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
          <ShieldCheck className="w-4 h-4" />
          <span>{isAr ? 'خصوصية كاملة 100% محلياً' : '100% Private & Local'}</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {isAr
            ? 'لا توجد حسابات خارجية أو رفع للسحابة. يتم تنزيل جميع الملفات وحفظها مباشرة على جهازك.'
            : 'No external accounts or cloud storage. All media is downloaded directly to your PC.'}
        </p>
      </div>
    </aside>
  );
};
