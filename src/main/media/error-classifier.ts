import { StructuredError, ErrorCategory } from '../../types';

export class ErrorClassifier {
  /**
   * Sanitizes diagnostic information by stripping sensitive tokens, session IDs, and user passwords.
   */
  public static sanitizeDetails(raw: string): string {
    if (!raw) return '';
    return raw
      // Signed CDN media URLs are short-lived credentials. Keep the host/path
      // useful for diagnosis while removing the complete query string.
      .replace(/(https?:\/\/[^\s?'"<>]+)\?[^\s'"<>]+/gi, '$1?[REDACTED]')
      // Strip token query parameters: &token=..., &sig=..., &key=...
      .replace(/([?&](?:token|sig|signature|key|auth|session|pass|password|expires)=)[^&\s]+/gi, '$1[REDACTED]')
      // Strip authorization headers or bearer tokens
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]')
      // Strip cookie strings
      .replace(/(cookie:\s*)[^\r\n]+/gi, '$1[REDACTED]')
      // Strip absolute local user paths where practical (e.g. C:\Users\Username\...)
      .replace(/([A-Za-z]:\\Users\\)[^\\]+/gi, '$1[USER]');
  }

  /**
   * Classifies an error message / stderr output into a structured, localized explanation.
   */
  public static classify(rawError: string, exitCode?: number): StructuredError {
    const text = (rawError || '').toLowerCase();
    const sanitized = this.sanitizeDetails(rawError || '');

    // 1. Cancelled by user
    if (text.includes('cancelled by user') || text.includes('user cancelled') || text.includes('sigterm')) {
      return {
        category: 'cancelled',
        titleEn: 'Download Cancelled',
        titleAr: 'تم إلغاء التنزيل',
        explanationEn: 'The download process was stopped manually.',
        explanationAr: 'تم إيقاف عملية التنزيل يدويًا بناءً على طلبك.',
        suggestedActionEn: 'You can retry or re-queue this download whenever you are ready.',
        suggestedActionAr: 'يمكنك إعادة المحاولة وإدراج التنزيل في قائمة الانتظار في أي وقت.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 2. Missing FFmpeg
    if (
      text.includes('ffmpeg') &&
      (text.includes('not found') || text.includes('not installed') || text.includes('ffmpeg-location'))
    ) {
      return {
        category: 'missing_ffmpeg',
        titleEn: 'FFmpeg Required',
        titleAr: 'مطلوب توفير برنامج FFmpeg',
        explanationEn: 'The selected format requires FFmpeg to merge video and audio streams together.',
        explanationAr: 'التنسيق أو الجودة المختارة تتطلب وجود محرك FFmpeg لدمج مسار الفيديو مع مسار الصوت.',
        suggestedActionEn: 'Check FFmpeg installation in Settings or configure its custom path.',
        suggestedActionAr: 'تحقق من تثبيت FFmpeg من شاشة الإعدادات أو حدد مساره يدوياً.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 3. Missing yt-dlp
    if (
      /(?:yt-dlp(?:\.exe)?[^\r\n]{0,80})(?:not found|could not be found|is missing|not recognized)/i.test(rawError) ||
      /(?:enoent|spawn)[^\r\n]{0,80}yt-dlp/i.test(rawError)
    ) {
      return {
        category: 'missing_ytdlp',
        titleEn: 'yt-dlp Not Found',
        titleAr: 'لم يتم العثور على محرك yt-dlp',
        explanationEn: 'The yt-dlp core downloader executable is missing or could not be launched.',
        explanationAr: 'الملف التنفيذي الأساسي لمحرك التنزيل yt-dlp مفقود أو تعذر تشغيله على نظامك.',
        suggestedActionEn: 'Verify yt-dlp installation in Settings or click Refresh Engine.',
        suggestedActionAr: 'تحقق من مسار yt-dlp في الإعدادات أو انقر على تحديث المحرك.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 4. Rate Limiting (HTTP 429) - Transient!
    if (text.includes('429') || text.includes('too many requests') || text.includes('rate limit')) {
      return {
        category: 'rate_limited',
        titleEn: 'Temporary Rate Limit',
        titleAr: 'تم تجاوز حد الطلبات مؤقتاً',
        explanationEn: 'The media hosting platform is temporarily throttling requests from your connection.',
        explanationAr: 'منصة الاستضافة تحد مؤقتاً من سرعة أو عدد الطلبات الصادرة من اتصالك.',
        suggestedActionEn: 'Wait a few moments before retrying. Automatic retries will use exponential backoff.',
        suggestedActionAr: 'انتظر بضع لحظات قبل إعادة المحاولة. ستستخدم المحاولة التلقائية تأخيراً تصاعدياً.',
        isTransient: true,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 5. Connection Interrupted / Reset - Transient!
    if (
      text.includes('connection reset') ||
      text.includes('remote disconnected') ||
      text.includes('10054') ||
      text.includes('connection closed') ||
      text.includes('broken pipe')
    ) {
      return {
        category: 'connection_interrupted',
        titleEn: 'Connection Interrupted',
        titleAr: 'انقطع اتصال الشبكة',
        explanationEn: 'The network connection was closed unexpectedly before the file finished transferring.',
        explanationAr: 'تم إغلاق اتصال الشبكة بشكل غير متوقع قبل اكتمال نقل الملف.',
        suggestedActionEn: 'Check your internet connection. Partial downloads can resume from where they stopped.',
        suggestedActionAr: 'تحقق من اتصال الإنترنت. يمكن استئناف التنزيل من النقطة التي توقف عندها.',
        isTransient: true,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 6. Network Timeout - Transient!
    if (text.includes('timed out') || text.includes('readtimeout') || text.includes('connecttimeout') || text.includes('econnrefused')) {
      return {
        category: 'network_timeout',
        titleEn: 'Network Request Timeout',
        titleAr: 'مهلة انتظار استجابة الشبكة انتهت',
        explanationEn: 'The media server did not respond within the allocated timeout period.',
        explanationAr: 'خادم الوسائط لم يستجب خلال المهلة الزمنية المحددة.',
        suggestedActionEn: 'Verify your internet connectivity and DNS settings, then retry.',
        suggestedActionAr: 'تحقق من استقرار اتصالك بالإنترنت وإعدادات الـ DNS ثم أعد المحاولة.',
        isTransient: true,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 7. Private or Deleted Media
    if (
      text.includes('private video') ||
      text.includes('this video is private') ||
      text.includes('video unavailable') ||
      text.includes('has been removed') ||
      text.includes('does not exist')
    ) {
      return {
        category: 'private_media',
        titleEn: 'Media Unavailable or Private',
        titleAr: 'المحتوى غير متاح أو خاص',
        explanationEn: 'This video or media item is marked private, deleted, or inaccessible without permissions.',
        explanationAr: 'هذا الفيديو أو الوسائط مصنفة كخاصة أو محذوفة أو غير قابلة للوصول بدون إذن.',
        suggestedActionEn: 'Verify the link in your web browser to confirm availability.',
        suggestedActionAr: 'تأكد من فتح الرابط في متصفحك للتأكد من إمكانية الوصول إليه.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 8. Authentication / Login Required
    if (
      text.includes('sign in') ||
      text.includes('login required') ||
      text.includes('age restricted') ||
      text.includes('members-only') ||
      (text.includes('403') && text.includes('forbidden'))
    ) {
      return {
        category: 'auth_required',
        titleEn: 'Authentication Required',
        titleAr: 'يتطلب تسجيل الدخول أو إذن خاص',
        explanationEn: 'This media requires account sign-in, membership verification, or age confirmation.',
        explanationAr: 'هذه الوسائط تتطلب تسجيل الدخول بحساب مصرح به أو تأكيد العمر أو عضوية مدفوعة.',
        suggestedActionEn: 'Access the media in your browser to check account requirements.',
        suggestedActionAr: 'افتح الوسائط في متصفحك للتأكد من متطلبات الحساب.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 9. Geo-Restricted
    if (text.includes('country') || text.includes('georestricted') || text.includes('not available in your country')) {
      return {
        category: 'geo_restricted',
        titleEn: 'Regionally Restricted',
        titleAr: 'المحتوى مقيد جغرافياً',
        explanationEn: 'The uploader or platform has restricted viewing of this media in your region.',
        explanationAr: 'قام الناشر أو المنصة بتقييد مشاهدة هذه الوسائط في منطقتك الجغرافية.',
        suggestedActionEn: 'The source restricts access from your current geographic location.',
        suggestedActionAr: 'المصدر يفرض قيود وصول تمنع المشاهدة من موقعك الجغرافي الحالي.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 10. Insufficient Disk Space
    if (text.includes('no space left') || text.includes('not enough space') || text.includes('disk full')) {
      return {
        category: 'insufficient_space',
        titleEn: 'Insufficient Disk Space',
        titleAr: 'مساحة القرص غير كافية',
        explanationEn: 'The destination drive does not have enough free space to save this download.',
        explanationAr: 'محرك الأقراص الوجهة لا يملك مساحة تخزينية كافية لحفظ هذا الملف.',
        suggestedActionEn: 'Free up disk space on the target drive or select a different download directory in Settings.',
        suggestedActionAr: 'قم بتفريغ مساحة على القرص أو اختر مجلداً مختلفاً للتنزيلات من شاشة الإعدادات.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 11. Permission Denied
    if (text.includes('permission denied') || text.includes('access is denied') || text.includes('errno 13')) {
      return {
        category: 'permission_denied',
        titleEn: 'Permission Denied',
        titleAr: 'تم رفض إذن الوصول إلى المجلد',
        explanationEn: 'Ddx Downloader lacks write permission to the designated output folder.',
        explanationAr: 'لا يملك البرنامج أذونات كافية لكتابة وحفظ الملفات في مجلد التنزيل المحدد.',
        suggestedActionEn: 'Choose a different folder or ensure your user account has write permissions.',
        suggestedActionAr: 'اختر مجلداً آخر أو تأكد من أن حساب المستخدم يملك صلاحيات الكتابة في هذا المجلد.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 12. Unsupported Format
    if (
      text.includes('requested format is not available') ||
      text.includes('no video formats found') ||
      text.includes('could not write header for output file') ||
      text.includes('incorrect codec parameters') ||
      (text.includes('experimental') && text.includes('opus in mp4')) ||
      (text.includes('ffmpeg exited with code') && text.includes('stream mapping'))
    ) {
      return {
        category: 'unsupported_format',
        titleEn: 'Format or Codec Incompatible',
        titleAr: 'التنسيق أو الترميز غير متوافق',
        explanationEn: 'The selected video, audio, and output container could not be combined safely.',
        explanationAr: 'تعذر دمج مسارات الفيديو والصوت داخل حاوية الإخراج المحددة بصورة متوافقة.',
        suggestedActionEn: 'Retry with Best Available Quality, MP4-compatible audio, or the MKV container.',
        suggestedActionAr: 'أعد المحاولة مع أفضل جودة متاحة أو صوت متوافق مع MP4 أو حاوية MKV.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 13. Invalid / Unsupported URL
    if (text.includes('unsupported url') || text.includes('not a valid url') || text.includes('no suitable extractor')) {
      return {
        category: 'invalid_url',
        titleEn: 'Unsupported Media URL',
        titleAr: 'رابط الوسائط غير مدعوم أو غير صالح',
        explanationEn: 'The provided web address is either malformed or belongs to an unsupported platform.',
        explanationAr: 'العنوان الإلكتروني المدخل غير صالح أو ينتمي إلى منصة غير مدعومة حالياً.',
        suggestedActionEn: 'Check the URL for typos and ensure it points directly to a supported video or playlist.',
        suggestedActionAr: 'تأكد من صحة الرابط وأنه يشير مباشرة إلى مقطع فيديو أو قائمة تشغيل مدعومة.',
        isTransient: false,
        sanitizedDetails: sanitized,
        exitCode,
      };
    }

    // 14. Generic Unknown Error
    return {
      category: 'unknown',
      titleEn: 'Download Failed',
      titleAr: 'فشل التنزيل',
      explanationEn: sanitized.slice(0, 150) || 'An unexpected error occurred during media processing.',
      explanationAr: 'حدث خطأ غير متوقع أثناء معالجة أو تنزيل ملف الوسائط.',
      suggestedActionEn: 'Inspect technical details or click Retry to attempt downloading again.',
      suggestedActionAr: 'راجع التفاصيل الفنية للخطأ أو انقر على إعادة المحاولة.',
      isTransient: false,
      sanitizedDetails: sanitized,
      exitCode,
    };
  }
}
