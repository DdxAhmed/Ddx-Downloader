import React, { useState } from 'react';
import { UpdateState } from '../../types';

export interface UpdateContentProps {
  updateState: UpdateState;
  lang?: 'en' | 'ar';
  onDownload: () => Promise<void>;
  onInstall: () => Promise<void>;
  onCheck?: () => Promise<void>;
  onDismiss?: () => void;
}

export const UpdateContent: React.FC<UpdateContentProps> = ({ updateState: state, lang = 'en', onDownload, onInstall, onCheck, onDismiss }) => {
  const ar = lang === 'ar';
  const [pending, setPending] = useState(false);
  const run = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    try { await action(); } finally { setPending(false); }
  };
  const busy = pending || ['checking', 'downloading', 'installing'].includes(state.status);
  const labels = {
    idle: ar ? 'تحقق من وجود تحديثات.' : 'Check for updates.',
    checking: ar ? 'جاري التحقق من التحديثات…' : 'Checking for updates…',
    available: ar ? 'يتوفر تحديث جديد' : 'Update available',
    'not-available': ar ? 'لا توجد تحديثات متاحة.' : 'No updates available.',
    downloading: ar ? 'جاري تنزيل التحديث داخل التطبيق…' : 'Downloading update in the app…',
    downloaded: ar ? 'تم تنزيل التحديث — لم يتم تثبيته بعد' : 'Update downloaded — not installed yet',
    installing: ar ? 'جاري تطبيق التحديث وإعادة التشغيل…' : 'Applying update and restarting…',
    error: ar ? 'تعذر إكمال التحديث' : 'Update could not be completed',
  };
  const buttonClass = 'btn-glow-primary px-5 py-2.5 rounded-2xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none';
  return <div className="space-y-4" dir={ar ? 'rtl' : 'ltr'}>
    <p role="status" className="text-sm font-bold text-white">{labels[state.status]}</p>
    <p className="text-xs text-slate-400">
      {ar ? 'الإصدار المثبت:' : 'Installed version:'} <span className="font-mono text-slate-300">{state.currentVersion}</span>
      {state.updateInfo && <> · {ar ? 'الإصدار الجديد:' : 'New version:'} <span className="font-mono text-indigo-300 font-bold">{state.updateInfo.version}</span></>}
    </p>
    {state.updateInfo?.releaseNotes && <p className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-slate-300 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] custom-scrollbar">{state.updateInfo.releaseNotes}</p>}
    {state.status === 'downloading' && <div className="space-y-2">
      <progress aria-label={ar ? 'تقدم تنزيل التحديث' : 'Update download progress'} className="w-full h-2 rounded-full overflow-hidden accent-indigo-500" max={100} value={state.progress?.percent || 0} />
      <p className="text-xs text-slate-400 font-mono">{(state.progress?.percent || 0).toFixed(1)}%
        {state.progress && state.progress.total > 0 && <> · {(state.progress.transferred / 1048576).toFixed(1)} / {(state.progress.total / 1048576).toFixed(1)} MiB · {(state.progress.bytesPerSecond / 1048576).toFixed(1)} MiB/s</>}
      </p>
    </div>}
    {state.status === 'downloaded' && <p className="text-xs text-slate-300 leading-relaxed">
      {state.installOnExit === false
        ? (ar ? 'تم تأجيل التثبيت عند الخروج لحماية بياناتك. راجع تفاصيل الخطأ أدناه.' : 'Installation on exit is deferred to protect your data. See the error details below.')
        : (ar ? 'أعد التشغيل للتحديث الآن، أو اختر «لاحقًا» لتطبيقه عند خروجك من التطبيق. سيتم الاحتفاظ ببياناتك وملفاتك.' : 'Restart to update now, or choose Later to apply it when you exit the app. Your data and media will be kept.')}
    </p>}
    {state.error && <p role="alert" className="text-xs text-rose-300 p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30">{ar ? 'تفاصيل الخطأ: ' : 'Error details: '}{state.error}</p>}
    <div className="flex gap-3 flex-wrap pt-2">
      {onCheck && ['idle', 'not-available', 'error', 'checking'].includes(state.status) && <button className={buttonClass} disabled={busy} onClick={() => void run(onCheck)}>{ar ? 'التحقق من التحديثات' : 'Check for updates'}</button>}
      {(state.status === 'available' || (state.status === 'error' && state.updateInfo)) && <button className={buttonClass} disabled={busy} onClick={() => void run(onDownload)}>{ar ? 'تنزيل التحديث' : 'Download update'}</button>}
      {state.status === 'downloaded' && <button className={buttonClass} disabled={busy} onClick={() => void run(onInstall)}>{ar ? 'إعادة التشغيل للتحديث' : 'Restart to update'}</button>}
      {onDismiss && state.status !== 'installing' && <button className="px-5 py-2.5 rounded-2xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all cursor-pointer" onClick={onDismiss}>{state.status === 'downloading' ? (ar ? 'متابعة في الخلفية' : 'Continue in background') : (ar ? 'لاحقًا' : 'Later')}</button>}
    </div>
  </div>;
};
