import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { validateRelease, validateUploadedAssets } from './validate-release.mjs';

const directories = [];
afterEach(() => { vi.unstubAllGlobals(); for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddx-release-'));
  directories.push(dir);
  const name = 'Ddx-Downloader-Setup-1.1.0.exe';
  const bytes = Buffer.from('test installer bytes');
  const sha512 = crypto.createHash('sha512').update(bytes).digest('base64');
  fs.writeFileSync(path.join(dir, name), bytes);
  fs.writeFileSync(path.join(dir, `${name}.blockmap`), gzipSync(JSON.stringify({ version: '2', files: [{ sizes: [bytes.length], checksums: ['test'] }] })));
  fs.writeFileSync(path.join(dir, 'latest.yml'), JSON.stringify({ version: '1.1.0', path: name, sha512, files: [{ url: name, size: bytes.length, sha512 }] }));
  return { dir, name };
}
describe('Release artifact validation', () => {
  it('accepts matching metadata and all generated artifacts', async () => {
    const { dir, name } = fixture();
    expect(await validateRelease(dir, '1.1.0', 'v1.1.0')).toEqual([name, 'latest.yml', `${name}.blockmap`]);
  });
  it('rejects tag mismatch', async () => {
    const { dir } = fixture();
    await expect(validateRelease(dir, '1.1.0', 'v1.2.0')).rejects.toThrow('Tag');
  });
  it('rejects corrupted bytes even when the size matches', async () => {
    const { dir, name } = fixture();
    fs.writeFileSync(path.join(dir, name), 'Test installer bytes');
    await expect(validateRelease(dir, '1.1.0')).rejects.toThrow('SHA-512');
  });
  it('rejects missing blockmaps', async () => {
    const { dir, name } = fixture();
    fs.unlinkSync(path.join(dir, `${name}.blockmap`));
    await expect(validateRelease(dir, '1.1.0')).rejects.toThrow('blockmap');
  });
  it('rejects renamed metadata URLs', async () => {
    const { dir } = fixture();
    const metadata = JSON.parse(fs.readFileSync(path.join(dir, 'latest.yml')));
    metadata.files[0].url = 'renamed.exe';
    fs.writeFileSync(path.join(dir, 'latest.yml'), JSON.stringify(metadata));
    await expect(validateRelease(dir, '1.1.0')).rejects.toThrow('filename');
  });
  it('rejects incorrect uploaded artifact URLs', async () => {
    const { dir, name } = fixture();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ tag_name: 'v1.1.0', assets: [{ name, size: 20, state: 'uploaded', browser_download_url: 'https://example.com/wrong.exe' }] }) })));
    await expect(validateUploadedAssets(dir, [name], 'DdxAhmed/Ddx-Downloader', 'v1.1.0', 'test-token')).rejects.toThrow('URL');
  });
  it.each([false, true])('checks uploaded response bytes and hashes (corrupt=%s)', async (corrupt) => {
    const { dir, name } = fixture();
    const local = fs.readFileSync(path.join(dir, name));
    const body = Buffer.from(local);
    if (corrupt) body[0] ^= 1;
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ tag_name: 'v1.1.0', assets: [{ id: 1, name, size: local.length, state: 'uploaded', browser_download_url: `https://github.com/DdxAhmed/Ddx-Downloader/releases/download/v1.1.0/${name}` }] }) })
      .mockResolvedValueOnce({ ok: true, body: (async function* () { yield body; })() }));
    const result = validateUploadedAssets(dir, [name], 'DdxAhmed/Ddx-Downloader', 'v1.1.0', 'test-token');
    if (corrupt) await expect(result).rejects.toThrow('hash mismatch');
    else await expect(result).resolves.toBeUndefined();
  });
});
