import { describe, it, expect } from 'vitest';
import path from 'path';
import { sanitizeFilename, buildOutputPath, parseTimestamp, validateTimeRange } from '../main/media/filename-sanitizer';

describe('Filename Sanitizer & Path Builder', () => {
  it('removes illegal Windows filesystem characters', () => {
    const raw = 'Lesson 1: Introduction to AI? (Part *1*) <Advanced> | "High Quality"';
    const clean = sanitizeFilename(raw);

    // Characters like : * ? < > | " must not exist
    expect(clean).not.toMatch(/[\\/:*?"<>|]/);
    expect(clean).toBe('Lesson 1_ Introduction to AI_ (Part _1_) _Advanced_ _ _High Quality_');
  });

  it('removes trailing spaces and dots which Windows forbids', () => {
    const raw = 'My Great Video...   ';
    const clean = sanitizeFilename(raw);
    expect(clean).toBe('My Great Video');
  });

  it('truncates excessively long titles to avoid MAX_PATH crashes', () => {
    const veryLong = 'a'.repeat(300);
    const clean = sanitizeFilename(veryLong);
    expect(clean.length).toBeLessThanOrEqual(180);
  });

  it('builds standard output path for single downloads', () => {
    const out = buildOutputPath('C:/Downloads', 'My Video', 'mp4');
    expect(out).toBe(path.join('C:/Downloads', 'My Video.mp4'));
  });

  it('builds organized course / playlist structure with lesson numbering', () => {
    const out = buildOutputPath('C:/Downloads', 'Electric Field', 'mp4', {
      isPlaylist: true,
      playlistTitle: 'Physics 101',
      playlistIndex: 1,
    });

    const expected = path.join('C:/Downloads', 'Physics 101', '01 - Electric Field.mp4');
    expect(out).toBe(expected);
  });

  it('preserves Arabic and Unicode text while removing forbidden characters', () => {
    const raw = 'الدرس الأول: مقدمة في الذكاء الاصطناعي؟ <مهم>';
    const clean = sanitizeFilename(raw);
    expect(clean).toContain('الدرس الأول');
    expect(clean).toContain('مقدمة في الذكاء الاصطناعي');
    expect(clean).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('safely handles Windows reserved DOS names like CON and NUL', () => {
    expect(sanitizeFilename('CON')).toBe('CON_file');
    expect(sanitizeFilename('nul')).toBe('nul_file');
    expect(sanitizeFilename('aux')).toBe('aux_file');
  });

  it('parses supported clip timestamps and rejects malformed clock values', () => {
    expect(parseTimestamp('02:15')).toBe(135);
    expect(parseTimestamp('01:02:03.5')).toBe(3723.5);
    expect(parseTimestamp('95.5')).toBe(95.5);
    expect(parseTimestamp('01:60')).toBeNull();
    expect(parseTimestamp('-1')).toBeNull();
  });

  it('validates clip bounds and creates an unmistakable clip filename', () => {
    expect(validateTimeRange(135, 220, 720).valid).toBe(true);
    expect(validateTimeRange(220, 135, 720).valid).toBe(false);
    expect(validateTimeRange(135, 800, 720).valid).toBe(false);

    const out = buildOutputPath('C:/Downloads', 'عنوان الفيديو', 'mp4', {
      timeRange: { start: 135, end: 220 },
    });
    expect(out).toContain('عنوان الفيديو [02m15s-03m40s].mp4');
  });
});
