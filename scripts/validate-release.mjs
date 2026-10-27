import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// Use the same YAML parser dependency as the installed electron-updater.
const require = createRequire(import.meta.url);
const updaterRequire = createRequire(require.resolve('electron-updater/package.json'));
const { load } = updaterRequire('js-yaml');
const digest = (bytes) => crypto.createHash('sha512').update(bytes).digest('base64');
const ensure = (condition, message) => { if (!condition) throw new Error(message); };

export async function validateRelease(directory, version, tag) {
  ensure(/^\d+\.\d+\.\d+$/.test(version), 'Stable release requires an x.y.z version');
  if (tag) ensure(tag === `v${version}`, `Tag ${tag} does not match package version ${version}`);
  const metadata = load(fs.readFileSync(path.join(directory, 'latest.yml'), 'utf8'));
  ensure(metadata.version === version, 'latest.yml version does not match package.json');
  ensure(Array.isArray(metadata.files) && metadata.files.length === 1, 'Expected one x64 NSIS installer in metadata');
  const file = metadata.files[0];
  const filename = `Ddx-Downloader-Setup-${version}.exe`;
  ensure(file.url === filename && metadata.path === filename, 'Metadata must reference the original versioned installer filename');
  const installers = fs.readdirSync(directory).filter((name) => name.endsWith('.exe'));
  ensure(installers.length === 1 && installers[0] === filename, 'Unexpected or stale installer in release directory');
  const bytes = fs.readFileSync(path.join(directory, filename));
  ensure(file.size === bytes.length && file.size > 0, 'Installer size mismatch');
  ensure(file.sha512 === digest(bytes) && metadata.sha512 === file.sha512, 'Installer SHA-512 mismatch');
  const maps = fs.readdirSync(directory).filter((name) => name.endsWith('.blockmap'));
  ensure(maps.includes(`${filename}.blockmap`), 'Missing installer blockmap');
  for (const name of maps) {
    const blockmap = JSON.parse(gunzipSync(fs.readFileSync(path.join(directory, name))).toString());
    ensure(blockmap.version && blockmap.files?.length > 0, `Invalid blockmap: ${name}`);
    for (const entry of blockmap.files) {
      ensure(entry.sizes?.length > 0 && entry.sizes.length === entry.checksums?.length &&
        entry.sizes.every((size) => Number.isInteger(size) && size > 0), `Invalid blockmap entries: ${name}`);
    }
  }
  const names = [filename, 'latest.yml', ...maps];
  console.log(`Validated version ${version}, installer ${bytes.length} bytes, SHA-512 and ${maps.length} blockmap(s).`);
  return names;
}

export async function validateUploadedAssets(directory, names, repository, tag, token) {
  ensure(/^[\w.-]+\/[\w.-]+$/.test(repository), 'Invalid GitHub repository');
  const headers = { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
  const response = await fetch(`https://api.github.com/repos/${repository}/releases/tags/${encodeURIComponent(tag)}`, { headers });
  ensure(response.ok, `Cannot read release metadata: HTTP ${response.status}`);
  const release = await response.json();
  ensure(release.tag_name === tag, 'Release tag mismatch');
  for (const name of names) {
    const asset = release.assets.find((item) => item.name === name);
    const local = fs.readFileSync(path.join(directory, name));
    ensure(asset?.size === local.length && asset.state === 'uploaded', `Uploaded asset missing or size mismatch: ${name}`);
    const expectedUrl = `https://github.com/${repository}/releases/download/${tag}/${name}`;
    ensure(decodeURI(asset.browser_download_url) === expectedUrl, `Unexpected artifact URL: ${name}`);
    // Draft downloads require the assets API; never put the token into a URL or a log.
    const download = await fetch(`https://api.github.com/repos/${repository}/releases/assets/${asset.id}`, {
      headers: { ...headers, Accept: 'application/octet-stream' },
    });
    ensure(download.ok && download.body, `Asset retrieval failed: ${name}: HTTP ${download.status}`);
    const hash = crypto.createHash('sha512');
    let transferred = 0;
    for await (const chunk of download.body) { hash.update(chunk); transferred += chunk.length; }
    ensure(transferred === local.length && hash.digest('base64') === digest(local), `Uploaded asset hash mismatch: ${name}`);
    console.log(`Verified uploaded ${name}: ${transferred} bytes and SHA-512 match.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const directory = process.argv[2] || 'release';
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
    const names = await validateRelease(directory, pkg.version, tag);
    if (process.argv.includes('--github')) {
      ensure(tag && process.env.GH_TOKEN, 'GitHub verification requires a tag and GH_TOKEN');
      await validateUploadedAssets(directory, names, process.env.GITHUB_REPOSITORY, tag, process.env.GH_TOKEN);
    }
  } catch (error) { console.error(`Release validation failed: ${error.message}`); process.exitCode = 1; }
}
