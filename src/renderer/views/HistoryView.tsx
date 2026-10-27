import React, { useState } from 'react';
import {
  History as HistoryIcon,
  Search,
  Trash2,
  Folder,
  Play,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { DownloadHistoryEntry } from '../../types';
import { SupportedLanguage, getTranslation } from '../i18n';

interface HistoryViewProps {
  history: DownloadHistoryEntry[];
  onOpenFile: (filePath: string) => Promise<void>;
  onOpenFolder: (filePath: string) => Promise<void>;
  onDeleteEntry: (id: string, deleteFile: boolean) => Promise<void>;
  onClearHistory: () => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang?: SupportedLanguage;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onOpenFile,
  onOpenFolder,
  onDeleteEntry,
  onClearHistory,
  onShowToast,
  lang = 'en',
}) => {
  const isAr = lang === 'ar';
  const t = (key: string) => getTranslation(key, lang);
  const [search, setSearch] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const filtered = history.filter((item) =>
    item.mediaTitle.toLowerCase().includes(search.toLowerCase()) ||
    item.sourceUrl.toLowerCase().includes(search.toLowerCase())
  );

  const handleClear = async () => {
    await onClearHistory();
    setShowClearConfirm(false);
    onShowToast(isAr ? 'تم مسح سجل التنزيلات.' : 'Download history cleared.', 'info');
  };

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-7 max-w-[1440px] mx-auto space-y-6 animate-fadeIn">
      {/* Top Search & Clear Bar */}
      <div className="glass-acrylic p-4 rounded-2xl border border-white/[0.08] flex items-center justify-between gap-4 shadow-md">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchHistory')}
            className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
          />
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/20 transition-all cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('clearHistory')}</span>
          </button>
        )}
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="glass-acrylic-card rounded-3xl p-12 text-center space-y-3 border border-white/[0.08] shadow-xl">
          <HistoryIcon className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">{t('noHistory')}</h3>
          <p className="text-xs text-slate-400">
            {history.length === 0 ? t('noHistoryDesc') : t('noHistoryMatch')}
          </p>
        </div>
      ) : (
        <div className="glass-acrylic-card rounded-2xl border border-white/[0.08] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/25 border-b border-white/[0.06] text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">{t('mediaTitle')}</th>
                  <th className="py-3.5 px-4">{t('platform')}</th>
                  <th className="py-3.5 px-4">{t('format')}</th>
                  <th className="py-3.5 px-4">{t('size')}</th>
                  <th className="py-3.5 px-4">{t('date')}</th>
                  <th className="py-3.5 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-slate-300">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.04] transition-colors">
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-semibold text-white truncate" title={item.mediaTitle}>
                        {item.mediaTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                        {item.filePath}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/25 text-indigo-300 font-bold uppercase text-[10px]">
                        {item.sourcePlatform}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {item.format}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {formatBytes(item.fileSize)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(item.completedAt).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenFile(item.filePath)}
                          className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all cursor-pointer shadow-sm"
                          title={isAr ? 'تشغيل الملف' : 'Open File'}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenFolder(item.filePath)}
                          className="p-2 rounded-lg glass-acrylic hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all cursor-pointer"
                          title={isAr ? 'فتح المجلد الحاوي' : 'Open Containing Folder'}
                        >
                          <Folder className="w-3.5 h-3.5 text-indigo-400" />
                        </button>

                        <button
                          onClick={() => onDeleteEntry(item.id, false)}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                          title={isAr ? 'حذف من السجل' : 'Delete History Entry'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-acrylic-card border border-white/[0.1] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">{t('clearHistoryConfirmTitle')}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              {t('clearHistoryConfirmDesc')}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white glass-acrylic hover:bg-white/[0.08] transition-all cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                {t('clearHistory')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
