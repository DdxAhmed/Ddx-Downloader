import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UpdateContent } from './UpdateContent';

afterEach(cleanup);
describe('Bilingual update UI', () => {
  it('starts installation only on click and disables duplicate requests during confirmation', async () => {
    let finish!: () => void;
    const install = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<UpdateContent updateState={{ status: 'downloaded', currentVersion: '1.0.0' }} onDownload={vi.fn()} onInstall={install} />);
    const button = screen.getByRole('button', { name: 'Restart to update' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(install).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(button.disabled).toBe(false);
  });
  it.each(['en', 'ar'] as const)('offers explicit restart and Later in %s', (lang) => {
    const install = vi.fn(async () => {});
    const later = vi.fn();
    render(<UpdateContent lang={lang} updateState={{ status: 'downloaded', currentVersion: '1.0.0', updateInfo: { version: '1.1.0' } }} onDownload={vi.fn()} onInstall={install} onDismiss={later} />);
    expect(install).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: lang === 'ar' ? 'لاحقًا' : 'Later' }));
    expect(later).toHaveBeenCalledOnce();
    expect(install).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: lang === 'ar' ? 'إعادة التشغيل للتحديث' : 'Restart to update' })).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
  it('shows reported progress without claiming differential transfer', () => {
    render(<UpdateContent updateState={{ status: 'downloading', currentVersion: '1.0.0', progress: { percent: 25, transferred: 1048576, total: 4194304, bytesPerSecond: 1048576 } }} onDownload={vi.fn()} onInstall={vi.fn()} />);
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('25');
    expect(screen.getByText(/1.0 \/ 4.0 MiB/)).toBeTruthy();
    expect(screen.queryByText(/differential/i)).toBeNull();
  });
  it('shows errors and an in-app download retry', () => {
    render(<UpdateContent updateState={{ status: 'error', currentVersion: '1.0.0', error: 'Network unavailable', updateInfo: { version: '1.1.0' } }} onDownload={vi.fn()} onInstall={vi.fn()} />);
    expect(screen.getByRole('alert').textContent).toContain('Network unavailable');
    expect(screen.getByRole('button', { name: 'Download update' })).toBeTruthy();
  });
});
