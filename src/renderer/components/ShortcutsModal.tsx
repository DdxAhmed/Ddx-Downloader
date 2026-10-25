import React from 'react';
import { X, Command, Keyboard } from 'lucide-react';
import { SupportedLanguage } from '../i18n';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: SupportedLanguage;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  const isAr = lang === 'ar';

  const shortcuts = [
    { key: 'Ctrl + 1', descEn: 'Switch to Home Dashboard', descAr: 'الانتقال إلى لوحة التحكم الرئيسية' },
    { key: 'Ctrl + 2', descEn: 'Switch to Downloads Manager', descAr: 'الانتقال إلى إدارة التنزيلات' },
    { key: 'Ctrl + 3', descEn: 'Switch to Courses & Playlists', descAr: 'الانتقال إلى الدورات وقوائم التشغيل' },
    { key: 'Ctrl + 4', descEn: 'Switch to Media Converter', descAr: 'الانتقال إلى محول الوسائط' },
    { key: 'Ctrl + 5', descEn: 'Switch to Local Media Library', descAr: 'الانتقال إلى مكتبة الوسائط' },
    { key: 'Ctrl + 6', descEn: 'Switch to History Audit Log', descAr: 'الانتقال إلى سجل التنزيلات' },
    { key: 'Ctrl + 7', descEn: 'Switch to Settings & Preferences', descAr: 'الانتقال إلى الإعدادات' },
    { key: 'Ctrl + V / N', descEn: 'Paste and analyze media URL', descAr: 'لصق وفحص رابط الوسائط' },
    { key: 'Ctrl + P', descEn: 'Pause or resume download queue', descAr: 'إيقاف مؤقت أو استئناف قائمة التنزيلات' },
    { key: 'Ctrl + ,', descEn: 'Open Settings directly', descAr: 'فتح شاشة الإعدادات مباشرة' },
    { key: '?', descEn: 'Open this keyboard shortcuts reference', descAr: 'عرض نافذة اختصارات لوحة المفاتيح هذه' },
    { key: 'Esc', descEn: 'Close active modal / dialog', descAr: 'إغلاق النوافذ المنبثقة النشطة' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isAr ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? 'إجراءات سريعة لتسريع استخدام البرنامج' : 'Quick key combinations to navigate Ddx Downloader'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:bg-slate-800/70 transition-colors text-xs"
            >
              <span className="text-slate-300 font-medium">
                {isAr ? s.descAr : s.descEn}
              </span>
              <kbd className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-700 text-indigo-300 font-mono font-semibold text-[11px] shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            {isAr ? 'حسناً، فهمت' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
