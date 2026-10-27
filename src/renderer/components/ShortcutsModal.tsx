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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-xl glass-acrylic-card border border-white/[0.1] rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500/30 to-purple-500/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Keyboard className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">
                {isAr ? 'اختصارات لوحة المفاتيح' : 'Keyboard Shortcuts'}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? 'إجراءات سريعة لتسريع استخدام البرنامج' : 'Quick key combinations to navigate Ddx Downloader'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white glass-acrylic hover:bg-white/[0.08] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {shortcuts.map((s, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] hover:border-indigo-500/30 transition-all text-xs"
            >
              <span className="text-slate-200 font-medium">
                {isAr ? s.descAr : s.descEn}
              </span>
              <kbd className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-white/[0.12] text-indigo-300 font-mono font-bold text-[11px] shadow-inner tracking-wider">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/[0.08] flex justify-end">
          <button
            onClick={onClose}
            className="btn-glow-primary px-6 py-2.5 rounded-2xl text-xs font-bold text-white shadow-xl cursor-pointer"
          >
            {isAr ? 'حسناً، فهمت' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};
