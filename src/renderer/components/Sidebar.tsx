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
    <aside className="app-sidebar w-[248px] h-screen flex flex-col justify-between select-none shrink-0 z-20">
      {/* Brand Header */}
      <div>
        <div className="px-5 pt-6 pb-5 flex items-center gap-3.5 border-b border-white/[0.06]">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-2xl blur-sm opacity-60 group-hover:opacity-100 transition duration-300"></div>
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-extrabold text-[15px] text-white tracking-tight leading-none">
                Ddx Downloader
              </h1>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1 truncate">
              {isAr ? 'محرك الوسائط الشامل' : 'Universal Media Engine'}
            </p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="px-3.5 py-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-item w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-[13px] transition-all duration-200 group ${
                  isActive
                    ? 'active text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-indigo-500/30 text-indigo-300 shadow-sm shadow-indigo-500/20'
                        : 'text-slate-400 group-hover:text-indigo-400 group-hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 font-mono text-[10px] font-bold shadow-sm shadow-cyan-500/20">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400"></span>
                    </span>
                    <span>{item.badge}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Local-First Guarantee Footer Card */}
      <div className="m-3.5 p-3.5 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.06] backdrop-blur-md">
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{isAr ? 'خصوصية كاملة 100% محلياً' : '100% Private & Local'}</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {isAr
            ? 'تنزيل مباشر لجهازك بدون تخزين سحابي أو تسجيل حسابات خارجية.'
            : 'Direct local downloads with no cloud telemetry or account requirements.'}
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
