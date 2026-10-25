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
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Search & Clear Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchHistory')}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {history.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('clearHistory')}</span>
          </button>
        )}
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3 border border-slate-800">
          <HistoryIcon className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">{t('noHistory')}</h3>
          <p className="text-xs text-slate-400">
            {history.length === 0 ? t('noHistoryDesc') : t('noHistoryMatch')}
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t('mediaTitle')}</th>
                  <th className="py-3 px-4">{t('platform')}</th>
                  <th className="py-3 px-4">{t('format')}</th>
                  <th className="py-3 px-4">{t('size')}</th>
                  <th className="py-3 px-4">{t('date')}</th>
                  <th className="py-3 px-4 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-white truncate" title={item.mediaTitle}>
                        {item.mediaTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate font-mono">
                        {item.filePath}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold uppercase text-[10px]">
                        {item.sourcePlatform}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      {item.format}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      {formatBytes(item.fileSize)}
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {new Date(item.completedAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenFile(item.filePath)}
                          className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 hover:text-white"
                          title={isAr ? 'تشغيل الملف' : 'Open File'}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenFolder(item.filePath)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                          title={isAr ? 'فتح المجلد الحاوي' : 'Open Containing Folder'}
                        >
                          <Folder className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onDeleteEntry(item.id, false)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">{t('clearHistoryConfirmTitle')}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('clearHistoryConfirmDesc')}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleClear}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500"
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
