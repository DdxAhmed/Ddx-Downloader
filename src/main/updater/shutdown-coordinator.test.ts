import { describe, it, expect, vi } from 'vitest';
import { ShutdownCoordinator } from './shutdown-coordinator';
import { redactUpdaterMessage } from './updater-logger';
import { assertDataOutsideInstallDirectory } from './update-data-guard';
import path from 'path';

function fixture(active = true) {
  const order: string[] = [];
  const actions = {
    hasActiveWork: () => active,
    confirmInterruption: vi.fn(async () => true),
    pauseQueue: vi.fn(() => { order.push('pause'); }),
    stopProcesses: vi.fn(async () => { order.push('stop'); }),
    flushDatabase: vi.fn(() => { order.push('flush'); }),
    recover: vi.fn(),
  };
  return { actions, order, coordinator: new ShutdownCoordinator(actions) };
}
describe('Safe update shutdown', () => {
  it('blocks data in the NSIS replacement directory but permits sibling folders', () => {
    const install = path.resolve('example-app');
    expect(() => assertDataOutsideInstallDirectory(install, [path.join(install, 'downloads', 'lesson.mp4')])).toThrow('Update postponed');
    expect(() => assertDataOutsideInstallDirectory(install, [install])).toThrow('Update postponed');
    expect(() => assertDataOutsideInstallDirectory(install, [path.resolve('example-app-media', 'lesson.mp4')])).not.toThrow();
  });
  it('postpones without stopping work when the user chooses Later', async () => {
    const { actions, coordinator } = fixture();
    actions.confirmInterruption.mockResolvedValue(false);
    expect(await coordinator.prepare()).toBe(false);
    expect(actions.pauseQueue).not.toHaveBeenCalled();
    expect(actions.stopProcesses).not.toHaveBeenCalled();
  });
  it('saves before and after stopping processes and shares simultaneous requests', async () => {
    const { actions, order, coordinator } = fixture();
    await Promise.all([coordinator.prepare(), coordinator.prepare()]);
    expect(order).toEqual(['flush', 'pause', 'flush', 'stop', 'flush']);
    expect(actions.confirmInterruption).toHaveBeenCalledTimes(1);
    expect(coordinator.ready).toBe(true);
    await coordinator.prepare();
    expect(actions.stopProcesses).toHaveBeenCalledTimes(1);
  });
  it.each(['flushDatabase', 'stopProcesses'] as const)('aborts when %s fails', async (method) => {
    const { actions, coordinator } = fixture(false);
    actions[method].mockImplementation(() => { throw new Error('failure'); });
    await expect(coordinator.prepare()).rejects.toThrow('failure');
    expect(coordinator.ready).toBe(false);
    expect(actions.recover).toHaveBeenCalled();
  });
  it('redacts credentials, signed URLs and authorization headers', () => {
    const clean = redactUpdaterMessage('https://user:password@example.com/file?X-Amz-Signature=secret&token=abc\nAuthorization: Bearer private\nCookie: session=value\napi_key=hidden');
    for (const secret of ['password', 'secret', 'abc', 'private', 'session=value', 'hidden']) expect(clean).not.toContain(secret);
    expect(clean).toContain('example.com/file');
  });
});
