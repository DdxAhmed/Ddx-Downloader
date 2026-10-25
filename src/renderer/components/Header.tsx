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
    <header className="h-16 px-6 sm:px-8 flex items-center justify-between border-b border-slate-800/80 bg-[#0b0f19]/80 backdrop-blur-md sticky top-0 z-20">
      <div className="min-w-0 pr-4">
        <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight truncate">
          {title}
        </h2>
        <p className="text-xs text-slate-400 truncate">{subtitle}</p>
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
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
        >
          {isReady ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">{isAr ? 'المحرك جاهز' : 'Engine Ready'}</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="text-amber-400">{isAr ? 'جاري التحقق' : 'Verifying'}</span>
            </>
          )}
          <RefreshCw className="w-3 h-3 text-slate-400 hover:text-slate-200 transition-transform active:rotate-180" />
        </div>

        {/* Open Downloads Folder */}
        <button
          onClick={onOpenFolder}
          title={isAr ? 'فتح مجلد التنزيلات' : 'Open Downloads Folder'}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all"
        >
          <Folder className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isAr ? 'مجلد التنزيل' : 'Downloads'}</span>
        </button>

        {/* Mini Mode Toggle */}
        <button
          onClick={onToggleMiniMode}
          title={isAr ? 'التبديل إلى الوضع المصغر' : 'Switch to Mini Mode'}
          className="p-2 rounded-xl text-xs bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
        >
          <Minimize2 className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>

        {/* Keyboard Shortcuts Dialog */}
        <button
          onClick={onOpenShortcuts}
          title={isAr ? 'دليل اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts Guide (?)'}
          className="p-2 rounded-xl text-xs bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
        >
          <Keyboard className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>

        {/* Language Switcher */}
        <button
          onClick={onToggleLanguage}
          title={isAr ? 'التبديل إلى English' : 'Switch to العربية'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-indigo-300 hover:text-white hover:border-indigo-500/50 transition-all"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-400" />
          <span>{isAr ? 'English' : 'العربية'}</span>
        </button>

        {/* Theme Switcher */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl text-xs bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
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
