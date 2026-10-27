import React, { useState } from 'react';
import {
  Search,
  Film,
  Music,
  Folder,
  Play,
  Trash2,
  Calendar,
  HardDrive,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Copy,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { DownloadHistoryEntry } from '../../types';
import { SupportedLanguage } from '../i18n';

interface LibraryViewProps {
  history: DownloadHistoryEntry[];
  onOpenFile: (filePath: string) => Promise<void>;
  onOpenFolder: (filePath: string) => Promise<void>;
  onDeleteEntry: (id: string, deleteFile: boolean) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: SupportedLanguage;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  history,
  onOpenFile,
  onOpenFolder,
  onDeleteEntry,
  onShowToast,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Deletion modal state
  const [deleteModalItem, setDeleteModalItem] = useState<DownloadHistoryEntry | null>(null);
  const [deleteFromDisk, setDeleteFromDisk] = useState(false);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const totalSize = history.reduce((acc, h) => acc + (h.fileSize || 0), 0);
  const missingFilesCount = history.filter((h) => h.fileExists === false).length;

  const filteredHistory = history
    .filter((item) => {
      const matchesSearch = item.mediaTitle
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesPlatform =
        platformFilter === 'all' || item.sourcePlatform === platformFilter;
      const isAudio =
        item.filePath.endsWith('.mp3') || item.filePath.endsWith('.m4a');
      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'audio' && isAudio) ||
        (typeFilter === 'video' && !isAudio);

      return matchesSearch && matchesPlatform && matchesType;
    })
    .sort((a, b) => {
      let comp = 0;
      if (sortBy === 'date') {
        comp = new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      } else if (sortBy === 'title') {
        comp = a.mediaTitle.localeCompare(b.mediaTitle);
      } else if (sortBy === 'size') {
        comp = (b.fileSize || 0) - (a.fileSize || 0);
      }
      return sortOrder === 'asc' ? -comp : comp;
    });

  const confirmDelete = async () => {
    if (!deleteModalItem) return;
    try {
      await onDeleteEntry(deleteModalItem.id, deleteFromDisk);
      onShowToast(
        deleteFromDisk
          ? isAr
            ? 'تم حذف السجل وإزالة الملف من القرص.'
            : 'Removed entry and deleted file from disk.'
          : isAr
          ? 'تم حذف السجل من المكتبة.'
          : 'Removed entry from library.',
        'info'
      );
      setDeleteModalItem(null);
    } catch {
      onShowToast(isAr ? 'فشل حذف العنصر.' : 'Failed to delete item.', 'error');
    }
  };

  const copyPath = (p: string) => {
    navigator.clipboard.writeText(p);
    onShowToast(isAr ? 'تم نسخ مسار الملف إلى الحافظة' : 'Copied file path to clipboard', 'success');
  };

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-7 max-w-[1440px] mx-auto space-y-6 animate-fadeIn">
      {/* Top Search & Filter Bar */}
      <div className="glass-acrylic p-5 rounded-[24px] border border-white/[0.08] space-y-4 shadow-xl">
        {/* Statistics Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pb-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-4 text-slate-300 font-medium">
            <span>
              {isAr ? 'إجمالي الملفات:' : 'Total Items:'}{' '}
              <strong className="text-white font-mono">{history.length}</strong>
            </span>
            <span>
              {isAr ? 'الحجم الكلي:' : 'Total Storage:'}{' '}
              <strong className="text-indigo-400 font-mono">{formatBytes(totalSize)}</strong>
            </span>
            {missingFilesCount > 0 && (
              <span className="text-amber-400 font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {missingFilesCount} {isAr ? 'ملفات مفقودة أو منقولة' : 'files missing or moved'}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? 'البحث في الوسائط المحفوظة بالعنوان...' : 'Search downloaded media by title...'}
              className="w-full glass-input rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Platform filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="glass-input text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
            >
              <option value="all">{isAr ? 'جميع المنصات' : 'All Platforms'}</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="vimeo">Vimeo</option>
              <option value="tiktok">TikTok</option>
            </select>

            {/* Media type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="glass-input text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
            >
              <option value="all">{isAr ? 'جميع الصيغ' : 'All Formats'}</option>
              <option value="video">{isAr ? 'فيديو' : 'Videos'}</option>
              <option value="audio">{isAr ? 'صوتيات فقط' : 'Audio Only'}</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="glass-input text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
            >
              <option value="date">{isAr ? 'ترتيب بالتاريخ' : 'Sort by Date'}</option>
              <option value="title">{isAr ? 'ترتيب بالاسم' : 'Sort by Title'}</option>
              <option value="size">{isAr ? 'ترتيب بالحجم' : 'Sort by Size'}</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="p-2.5 rounded-xl glass-acrylic hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Toggle sort direction"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Library Items */}
      {filteredHistory.length === 0 ? (
        <div className="glass-acrylic-card rounded-3xl p-12 text-center space-y-3 border border-white/[0.08] shadow-xl">
          <Film className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {isAr ? 'لا توجد وسائط مطابقة' : 'No media items found'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isAr
              ? 'لم يتم العثور على وسائط مطابقة لمعايير البحث الحالية.'
              : 'No completed media items matched your search query or filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredHistory.map((item) => {
            const isAudio = item.filePath.endsWith('.mp3') || item.filePath.endsWith('.m4a');
            const isMissing = item.fileExists === false;

            return (
              <div
                key={item.id}
                className="glass-acrylic-card rounded-2xl p-4.5 border border-white/[0.08] hover:border-indigo-500/30 transition-all flex flex-col justify-between space-y-3.5 group shadow-md"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-24 h-16 rounded-xl bg-slate-900 border border-white/[0.08] shrink-0 overflow-hidden relative shadow-sm">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-600">
                        {isAudio ? <Music className="w-6 h-6" /> : <Film className="w-6 h-6" />}
                      </div>
                    )}

                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-white">
                      {item.format}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase">
                        {item.sourcePlatform}
                      </span>
                      {isMissing && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>{isAr ? 'ملف مفقود' : 'File Missing'}</span>
                        </span>
                      )}
                    </div>

                    <h4
                      className="text-xs font-bold text-white line-clamp-2 mt-1 leading-snug"
                      title={item.mediaTitle}
                    >
                      {item.mediaTitle}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-slate-500" />
                        <span>{formatBytes(item.fileSize)}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{new Date(item.completedAt).toLocaleDateString()}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {!isMissing ? (
                      <button
                        onClick={() => onOpenFile(item.filePath)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-md shadow-indigo-600/20"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تشغيل' : 'Play'}</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-amber-400">
                        {isAr ? 'الملف غير موجود بالمسار' : 'File not found on disk'}
                      </span>
                    )}

                    <button
                      onClick={() => onOpenFolder(item.filePath)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title={isAr ? 'عرض في المجلد' : 'Reveal in Folder'}
                    >
                      <Folder className="w-3.5 h-3.5 text-indigo-400" />
                    </button>

                    <button
                      onClick={() => copyPath(item.filePath)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                      title={isAr ? 'نسخ المسار' : 'Copy File Path'}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setDeleteModalItem(item);
                      setDeleteFromDisk(false);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all"
                    title={isAr ? 'حذف من المكتبة' : 'Remove entry'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>{isAr ? 'حذف من المكتبة' : 'Remove from Library'}</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {isAr
                ? `هل أنت متأكد من حذف "${deleteModalItem.mediaTitle}" من سجل المكتبة؟`
                : `Are you sure you want to remove "${deleteModalItem.mediaTitle}" from your library history?`}
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id="deleteFromDisk"
                checked={deleteFromDisk}
                onChange={(e) => setDeleteFromDisk(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-rose-500"
              />
              <label htmlFor="deleteFromDisk" className="text-rose-300 font-medium cursor-pointer">
                {isAr ? 'حذف الملف الفعلي من القرص الصلب نهائياً أيضاً' : 'Also delete the actual file from disk permanently'}
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setDeleteModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:text-white"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
              >
                {isAr ? 'تأكيد الحذف' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
