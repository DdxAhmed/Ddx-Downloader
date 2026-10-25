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
} from 'lucide-react';
import { DownloadHistoryEntry } from '../../types';

interface LibraryViewProps {
  history: DownloadHistoryEntry[];
  onOpenFile: (filePath: string) => Promise<void>;
  onOpenFolder: (filePath: string) => Promise<void>;
  onDeleteEntry: (id: string, deleteFile: boolean) => Promise<void>;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  history,
  onOpenFile,
  onOpenFolder,
  onDeleteEntry,
  onShowToast,
}) => {
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
          ? 'Removed entry and deleted file from disk.'
          : 'Removed entry from library.',
        'info'
      );
      setDeleteModalItem(null);
    } catch {
      onShowToast('Failed to delete item.', 'error');
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6 animate-fadeIn">
      {/* Top Search & Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search downloaded media by title..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Platform filter */}
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
            >
              <option value="all">All Platforms</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="vimeo">Vimeo</option>
              <option value="tiktok">TikTok</option>
            </select>

            {/* Media type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
            >
              <option value="all">All Formats</option>
              <option value="video">Videos</option>
              <option value="audio">Audio Only</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-700/80 text-slate-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none"
            >
              <option value="date">Sort by Date</option>
              <option value="title">Sort by Title</option>
              <option value="size">Sort by Size</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-400 hover:text-white"
              title={`Sorting ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Media Items */}
      {filteredHistory.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center space-y-3 border border-slate-800">
          <Film className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No media found</h3>
          <p className="text-xs text-slate-400">
            {history.length === 0
              ? 'You have not downloaded any media yet. Complete a download to populate your library.'
              : 'No items match your active filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredHistory.map((item) => {
            const isAudio =
              item.filePath.endsWith('.mp3') || item.filePath.endsWith('.m4a');
            return (
              <div
                key={item.id}
                className="glass-card rounded-2xl overflow-hidden border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                {/* Thumbnail / Header */}
                <div className="relative h-36 bg-slate-900 overflow-hidden">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      {isAudio ? <Music className="w-10 h-10" /> : <Film className="w-10 h-10" />}
                    </div>
                  )}

                  {/* Play Overlay Button */}
                  <div
                    onClick={() => onOpenFile(item.filePath)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <Play className="w-5 h-5 ml-0.5" />
                    </div>
                  </div>

                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-bold text-indigo-300 uppercase">
                    {item.sourcePlatform}
                  </span>

                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white">
                    {item.format}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4
                      className="text-xs font-bold text-white line-clamp-2 leading-snug"
                      title={item.mediaTitle}
                    >
                      {item.mediaTitle}
                    </h4>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2 font-medium">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-slate-500" />
                        {formatBytes(item.fileSize)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {new Date(item.completedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      onClick={() => onOpenFolder(item.filePath)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      title="Reveal in local folder"
                    >
                      <Folder className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Reveal</span>
                    </button>

                    <button
                      onClick={() => {
                        setDeleteModalItem(item);
                        setDeleteFromDisk(false);
                      }}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                      title="Remove from library"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Remove from Library</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to remove <span className="text-white font-medium">"{deleteModalItem.mediaTitle}"</span> from your library?
            </p>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
              <input
                type="checkbox"
                id="deleteDisk"
                checked={deleteFromDisk}
                onChange={(e) => setDeleteFromDisk(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-red-500 focus:ring-red-500"
              />
              <label htmlFor="deleteDisk" className="text-xs text-slate-300 cursor-pointer">
                Also delete the actual file from your hard drive
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/30"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
