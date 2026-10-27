import React from 'react';
import {
  Folder,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Globe,
  Sun,
  Moon,
  Minimize2,
  Keyboard,
} from 'lucide-react';
import { DependencyStatus } from '../../types';
import { SupportedLanguage } from '../i18n';

interface HeaderProps {
  title: string;
  subtitle: string;
  dependencies: DependencyStatus | null;
  onRefreshDeps: () => void;
  onOpenFolder: () => void;
  lang: SupportedLanguage;
  onToggleLanguage: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onToggleMiniMode: () => void;
  onOpenShortcuts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  dependencies,
  onRefreshDeps,
  onOpenFolder,
  lang,
  onToggleLanguage,
  theme,
  onToggleTheme,
  onToggleMiniMode,
  onOpenShortcuts,
}) => {
  const isAr = lang === 'ar';
  const isReady = dependencies?.ytDlp?.available && dependencies?.ffmpeg?.available;

  return (
    <header className="app-header h-[72px] px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="min-w-0 pr-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-400"></div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
            {title}
          </h2>
        </div>
        <p className="text-[11px] text-slate-400 truncate mt-0.5 ml-3.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Dependency Status Badge */}
        <div
          onClick={onRefreshDeps}
          title={
            isReady
              ? `yt-dlp: ${dependencies?.ytDlp.version || 'Ready'} | FFmpeg: ${
                  dependencies?.ffmpeg.version || 'Ready'
                }`
              : 'Dependency check required. Click to verify.'
          }
          className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-semibold glass-acrylic hover:border-indigo-500/40 cursor-pointer transition-all duration-200 group"
        >
          {isReady ? (
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="text-slate-200">{isAr ? 'المحرك متصل' : 'Engine Ready'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-amber-400">{isAr ? 'جاري التحقق' : 'Verifying'}</span>
            </div>
          )}
          <RefreshCw className="w-3 h-3 text-slate-400 group-hover:text-indigo-400 transition-transform group-hover:rotate-180 duration-500" />
        </div>

        {/* Open Downloads Folder */}
        <button
          onClick={onOpenFolder}
          title={isAr ? 'فتح مجلد التنزيلات' : 'Open Downloads Folder'}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium glass-acrylic hover:border-indigo-500/40 hover:bg-indigo-500/[0.08] text-slate-200 hover:text-white transition-all duration-200"
        >
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isAr ? 'المجلد' : 'Folder'}</span>
        </button>

        {/* Mini Mode Toggle */}
        <button
          onClick={onToggleMiniMode}
          title={isAr ? 'التبديل إلى الوضع المصغر' : 'Switch to Mini Mode'}
          className="p-2 rounded-xl text-xs glass-acrylic hover:border-indigo-500/40 hover:bg-white/[0.06] text-slate-300 hover:text-white transition-all"
        >
          <Minimize2 className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>

        {/* Keyboard Shortcuts Dialog */}
        <button
          onClick={onOpenShortcuts}
          title={isAr ? 'دليل اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts Guide (?)'}
          className="p-2 rounded-xl text-xs glass-acrylic hover:border-indigo-500/40 hover:bg-white/[0.06] text-slate-300 hover:text-white transition-all"
        >
          <Keyboard className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>

        {/* Language Switcher */}
        <button
          onClick={onToggleLanguage}
          title={isAr ? 'التبديل إلى English' : 'Switch to العربية'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold glass-acrylic hover:border-indigo-500/40 hover:bg-indigo-500/[0.08] text-indigo-300 hover:text-white transition-all duration-200"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isAr ? 'EN' : 'عربي'}</span>
        </button>

        {/* Theme Switcher */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl text-xs glass-acrylic hover:border-indigo-500/40 hover:bg-white/[0.06] text-slate-300 hover:text-white transition-all duration-200"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
