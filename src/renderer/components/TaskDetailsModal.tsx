import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  Folder,
  RotateCcw,
  FileText,
  Clock,
  HardDrive,
  ShieldAlert,
} from 'lucide-react';
import { DownloadJob } from '../../types';
import { SupportedLanguage } from '../i18n';

interface TaskDetailsModalProps {
  job: DownloadJob | null;
  isOpen: boolean;
  onClose: () => void;
  onRetry: (id: string) => void;
  onOpenFile: (filePath: string) => void;
  onOpenFolder: (filePath: string) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: SupportedLanguage;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  job,
  isOpen,
  onClose,
  onRetry,
  onOpenFile,
  onOpenFolder,
  onShowToast,
  lang,
}) => {
  if (!isOpen || !job) return null;

  const isAr = lang === 'ar';
  const isFailed = job.status === 'failed' || job.status === 'cancelled';
  const isCompleted = job.status === 'completed';

  const copyDiagnostic = () => {
    const diagnostic = {
      jobId: job.id,
      mediaTitle: job.mediaTitle,
      sourcePlatform: job.sourcePlatform,
      format: job.selectedQuality,
      container: job.targetContainer,
      status: job.status,
      retryCount: job.retryCount,
      errorCategory: job.errorDetails?.category,
      sanitizedError: job.errorDetails?.sanitizedDetails || job.errorMessage,
      exitCode: job.errorDetails?.exitCode,
      createdAt: job.createdAt,
    };

    navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2));
    onShowToast(
      isAr ? 'تم نسخ التقرير التشخيصي بأمان (بدون بيانات حساسة)' : 'Copied sanitized diagnostics to clipboard',
      'success'
    );
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isFailed
                  ? 'bg-rose-500/20 text-rose-400'
                  : isCompleted
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-indigo-500/20 text-indigo-400'
              }`}
            >
              {isFailed ? (
                <AlertTriangle className="w-5 h-5" />
              ) : isCompleted ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white line-clamp-1">
                {job.mediaTitle}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr ? 'تفاصيل ومواصفات مهمة التنزيل' : 'Download Task Specifications & Diagnostics'}
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

        {/* Content Body */}
        <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
          {/* Diagnostic Error Banner if Failed */}
          {isFailed && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-2">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wide">
                <ShieldAlert className="w-4 h-4" />
                <span>
                  {job.errorDetails
                    ? isAr
                      ? job.errorDetails.titleAr
                      : job.errorDetails.titleEn
                    : isAr
                    ? 'فشل التنزيل'
                    : 'Download Interrupted'}
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {job.errorDetails
                  ? isAr
                    ? job.errorDetails.explanationAr
                    : job.errorDetails.explanationEn
                  : job.errorMessage || 'An error occurred during media download.'}
              </p>
              {job.errorDetails?.suggestedActionEn && (
                <p className="text-[11px] text-rose-300/90 font-medium">
                  <span className="font-bold">{isAr ? 'الإجراء المقترح: ' : 'Suggested action: '}</span>
                  {isAr ? job.errorDetails.suggestedActionAr : job.errorDetails.suggestedActionEn}
                </p>
              )}
            </div>
          )}

          {/* Key Properties Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400 block mb-1">{isAr ? 'الحالة' : 'Status'}</span>
              <span className="font-semibold text-white capitalize">{job.status}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400 block mb-1">{isAr ? 'الجودة' : 'Quality'}</span>
              <span className="font-semibold text-white">{job.selectedQuality}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400 block mb-1">{isAr ? 'الحجم' : 'File Size'}</span>
              <span className="font-semibold text-white">{formatBytes(job.totalBytes)}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400 block mb-1">{isAr ? 'التقدم' : 'Progress'}</span>
              <span className="font-semibold text-white">{job.progress.toFixed(1)}%</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400 block mb-1">{isAr ? 'المحاولات' : 'Retries'}</span>
              <span className="font-semibold text-white">{job.retryCount || 0} / 3</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <span className="text-slate-400 block mb-1">{isAr ? 'المنصة' : 'Platform'}</span>
              <span className="font-semibold text-white capitalize">{job.sourcePlatform}</span>
            </div>
          </div>

          {/* File Output Path */}
          <div className="space-y-1.5 text-xs">
            <span className="text-slate-400 font-medium">{isAr ? 'مسار الملف المحفوظ' : 'Output File Path'}</span>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 break-all select-all">
              {job.outputPath}
            </div>
          </div>

          {/* Sanitized Technical Diagnostic Box */}
          {job.errorDetails?.sanitizedDetails && (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">
                  {isAr ? 'التفاصيل الفنية (بدون بيانات حساسة)' : 'Sanitized Technical Details'}
                </span>
                <button
                  onClick={copyDiagnostic}
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{isAr ? 'نسخ التقرير' : 'Copy Diagnostics'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-rose-300/80 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto select-all">
                {job.errorDetails.sanitizedDetails}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={copyDiagnostic}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700 transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{isAr ? 'نسخ التقرير' : 'Copy Diagnostics'}</span>
          </button>

          <div className="flex items-center gap-2">
            {isFailed && (
              <button
                onClick={() => {
                  onRetry(job.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isAr ? 'إعادة التنزيل' : 'Retry Download'}</span>
              </button>
            )}

            {isCompleted && (
              <>
                <button
                  onClick={() => onOpenFile(job.outputPath)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تشغيل الملف' : 'Play File'}</span>
                </button>
                <button
                  onClick={() => onOpenFolder(job.outputPath)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all"
                >
                  <Folder className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isAr ? 'عرض بالمجلد' : 'Reveal in Folder'}</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
