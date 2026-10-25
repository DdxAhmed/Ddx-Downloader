import { describe, it, expect } from 'vitest';
import path from 'path';
import { sanitizeFilename, buildOutputPath } from '../main/media/filename-sanitizer';

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
});
