import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Folder,
  FileVideo,
  Music,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { MediaConversionRequest, ConversionProgress } from '../../types';
import { SupportedLanguage } from '../i18n';

interface ConverterViewProps {
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  lang: SupportedLanguage;
}

export const ConverterView: React.FC<ConverterViewProps> = ({ onShowToast, lang }) => {
  const isAr = lang === 'ar';
  const [inputFilePath, setInputFilePath] = useState('');
  const [targetFormat, setTargetFormat] = useState<'mp4' | 'mkv' | 'webm' | 'mp3' | 'm4a' | 'aac' | 'flac'>('mp4');
  const [qualityPreset, setQualityPreset] = useState<'fast' | 'balanced' | 'high_quality' | 'compress'>('balanced');
  const [outputFilePath, setOutputFilePath] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState<ConversionProgress | null>(null);
  const [convertedPath, setConvertedPath] = useState<string | null>(null);

  useEffect(() => {
    if (!window.electronAPI?.onConversionProgress) return;
    const unsub = window.electronAPI.onConversionProgress((prog) => {
      setConversionProgress(prog);
      if (prog.status === 'completed') {
        setIsConverting(false);
        onShowToast(isAr ? 'اكتمل تحويل الملف بنجاح!' : 'Media conversion completed successfully!', 'success');
      } else if (prog.status === 'failed') {
        setIsConverting(false);
        onShowToast(prog.errorMessage || (isAr ? 'فشل تحويل الملف' : 'Conversion failed'), 'error');
      }
    });
    return () => unsub();
  }, [isAr, onShowToast]);

  const handleSelectInput = async () => {
    if (!window.electronAPI?.selectFileForConversion) return;
    const res = await window.electronAPI.selectFileForConversion();
    if (res.success && res.filePath) {
      setInputFilePath(res.filePath);
      // Auto suggest output path next to input file with new extension
      const lastDot = res.filePath.lastIndexOf('.');
      const base = lastDot > 0 ? res.filePath.substring(0, lastDot) : res.filePath;
      setOutputFilePath(`${base}_converted.${targetFormat}`);
      setConvertedPath(null);
    }
  };

  const handleFormatChange = (fmt: any) => {
    setTargetFormat(fmt);
    if (inputFilePath) {
      const lastDot = inputFilePath.lastIndexOf('.');
      const base = lastDot > 0 ? inputFilePath.substring(0, lastDot) : inputFilePath;
      setOutputFilePath(`${base}_converted.${fmt}`);
    }
  };

  const handleStartConversion = async () => {
    if (!inputFilePath.trim() || !outputFilePath.trim()) {
      onShowToast(isAr ? 'يرجى اختيار ملف الإدخال وتحديد مسار الإخراج.' : 'Please select an input file and output destination.', 'error');
      return;
    }

    setIsConverting(true);
    setConversionProgress({ status: 'converting', percent: 1 });
    setConvertedPath(null);

    const req: MediaConversionRequest = {
      inputPath: inputFilePath.trim(),
      outputPath: outputFilePath.trim(),
      targetFormat,
      qualityPreset,
    };

    const res = await window.electronAPI?.convertMedia?.(req);
    if (res && !res.success) {
      setIsConverting(false);
      onShowToast(res.error || 'Conversion failed', 'error');
    } else {
      setConvertedPath(outputFilePath.trim());
    }
  };

  const handleCancel = async () => {
    if (window.electronAPI?.cancelConversion) {
      await window.electronAPI.cancelConversion();
      setIsConverting(false);
      onShowToast(isAr ? 'تم إلغاء عملية التحويل' : 'Conversion cancelled', 'info');
    }
  };

  return (
    <div className="px-5 py-6 lg:px-8 lg:py-7 max-w-[1200px] mx-auto space-y-6 animate-fadeIn">
      {/* Header Banner */}
      <div className="glass-acrylic p-7 rounded-[26px] border border-white/[0.08] shadow-xl space-y-2.5 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
          <RefreshCw className="w-4 h-4" />
          <span>{isAr ? 'محول الوسائط المتقدم عبر FFmpeg' : 'Advanced FFmpeg Media Converter'}</span>
        </div>
        <h2 className="text-2xl lg:text-[28px] font-black text-white tracking-tight">
          {isAr ? 'تحويل الفيديو واستخراج الصوتيات بأعلى كفاءة' : 'Non-Destructive Video & Audio Conversion'}
        </h2>
        <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
          {isAr
            ? 'حوّل ملفاتك المحلية بين صيغ MP4 وMKV وWebM وMP3 وFLAC مع التحكم في الجودة وسرعة الترميز دون المساس بالملف الأصلي.'
            : 'Convert local videos and audios between MP4, MKV, WebM, MP3, AAC, and FLAC using FFmpeg presets without overwriting the original file.'}
        </p>
      </div>

      {/* Input File Selector */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] space-y-4 shadow-lg">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FileVideo className="w-4 h-4 text-indigo-400" />
          <span>{isAr ? '1. اختيار ملف الوسائط المصدر' : '1. Select Source Media File'}</span>
        </h3>

        <div className="flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={inputFilePath}
            placeholder={isAr ? 'انقر على استعراض لاختيار ملف فيديو أو صوت...' : 'Click Browse to pick a video or audio file...'}
            className="flex-1 glass-input rounded-xl px-4 py-3 text-xs text-slate-200 font-mono focus:outline-none"
          />
          <button
            onClick={handleSelectInput}
            disabled={isConverting}
            className="px-5 py-3 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-white border border-white/[0.08] transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Folder className="w-4 h-4 text-indigo-400" />
            <span>{isAr ? 'استعراض...' : 'Browse...'}</span>
          </button>
        </div>
      </div>

      {/* Conversion Options */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] space-y-5 shadow-lg">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span>{isAr ? '2. تنسيق الإخراج وإعدادات الجودة' : '2. Target Format & Presets'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {isAr ? 'صيغة الإخراج المطلوبة' : 'Target Format Container'}
            </label>
            <select
              value={targetFormat}
              onChange={(e) => handleFormatChange(e.target.value)}
              disabled={isConverting}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
            >
              <optgroup label="Video Formats">
                <option value="mp4">MP4 (H.264 / AAC - Universal Compatibility)</option>
                <option value="mkv">MKV (Matroska - Lossless Remux)</option>
                <option value="webm">WebM (VP9 / Opus - Web Optimized)</option>
              </optgroup>
              <optgroup label="Audio Extraction">
                <option value="mp3">MP3 (320 kbps High Quality Audio)</option>
                <option value="m4a">M4A (AAC 256 kbps Audio)</option>
                <option value="flac">FLAC (Lossless Studio Audio)</option>
                <option value="aac">AAC (Raw Advanced Audio)</option>
              </optgroup>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              {isAr ? 'مستوى جودة الترميز' : 'Quality / Speed Preset'}
            </label>
            <select
              value={qualityPreset}
              onChange={(e) => setQualityPreset(e.target.value as any)}
              disabled={isConverting}
              className="w-full glass-input rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="balanced">{isAr ? 'متوازن (موصى به - جودة ممتازة وسرعة عالية)' : 'Balanced (Recommended - High Quality & Fast)'}</option>
              <option value="high_quality">{isAr ? 'جودة فائقة (CRF 18 - حجم أكبر)' : 'Maximum Quality (CRF 18 - Larger File)'}</option>
              <option value="fast">{isAr ? 'سريع جداً (Ultrafast Encoding)' : 'Ultrafast (Quickest Processing)'}</option>
              <option value="compress">{isAr ? 'ضغط الحجم (توفير المساحة)' : 'Compress (Reduced File Size)'}</option>
            </select>
          </div>
        </div>

        {/* Output path preview */}
        <div className="space-y-1.5 text-xs">
          <label className="text-slate-400 font-medium">{isAr ? 'مسار الملف الناتج' : 'Output Target Path'}</label>
          <div className="p-3 rounded-xl bg-black/30 border border-white/[0.05] font-mono text-[11px] text-slate-300 break-all select-all">
            {outputFilePath || (isAr ? 'حدد ملف الإدخال لمعاينة مسار الإخراج' : 'Select an input file to generate output path')}
          </div>
        </div>
      </div>

      {/* Progress or Actions */}
      <div className="glass-acrylic-card p-6 rounded-2xl border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        {isConverting ? (
          <div className="flex-1 space-y-2 w-full">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2 font-medium">
                <RotateCw className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>{isAr ? 'جاري تحويل الوسائط...' : 'Encoding media with FFmpeg...'}</span>
              </span>
              {conversionProgress?.speed && (
                <span className="text-indigo-400 font-mono text-xs font-semibold">{conversionProgress.speed}</span>
              )}
            </div>
            <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/[0.05]">
              <div
                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-2 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                style={{ width: `${conversionProgress?.percent || 50}%` }}
              />
            </div>
          </div>
        ) : convertedPath ? (
          <div className="flex items-center gap-3 text-xs text-emerald-400 font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{isAr ? 'اكتمل التحويل! الملف جاهز للتشغيل.' : 'Conversion finished! Ready to play.'}</span>
          </div>
        ) : (
          <p className="text-xs text-slate-300">
            {isAr ? 'جاهز للبدء. لن يتم استبدال الملف الأصلي أبداً.' : 'Ready to encode. Original files are never modified or overwritten.'}
          </p>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {isConverting ? (
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-md"
            >
              {isAr ? 'إلغاء التحويل' : 'Cancel'}
            </button>
          ) : convertedPath ? (
            <>
              <button
                onClick={() => window.electronAPI?.openFile?.(convertedPath)}
                className="btn-glow-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>{isAr ? 'تشغيل' : 'Play File'}</span>
              </button>
              <button
                onClick={() => window.electronAPI?.openFolder?.(convertedPath)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold glass-acrylic hover:bg-white/[0.08] text-white border border-white/[0.08] transition-all cursor-pointer"
              >
                <Folder className="w-4 h-4 text-indigo-400" />
                <span>{isAr ? 'المجلد' : 'Folder'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleStartConversion}
              disabled={!inputFilePath}
              className="btn-glow-primary flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-extrabold text-white shadow-xl shadow-indigo-500/30 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'بدء التحويل الآن' : 'Start Conversion'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
