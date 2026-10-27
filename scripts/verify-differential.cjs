// Run with Electron, using real NSIS artifacts and the real electron-updater downloader.
// This harness NEVER installs, modifies a real installation, or publishes a release.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { NsisUpdater } = require('electron-updater');
const { ElectronHttpExecutor } = require('electron-updater/out/electronHttpExecutor');
const yaml = require(require.resolve('js-yaml', { paths: [path.dirname(require.resolve('electron-updater/package.json'))] }));

const [oldArg, nextArg, outputArg] = process.argv.slice(2);
if (!oldArg || !nextArg || !outputArg) throw new Error('Usage: electron verify-differential.cjs OLD_DIR NEW_DIR OUTPUT_DIR');
const oldDir = path.resolve(oldArg), nextDir = path.resolve(nextArg), output = path.resolve(outputArg);
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(path.join(output, 'electron-profile'), { recursive: true });
app.setPath('userData', path.join(output, 'electron-profile'));
app.disableHardwareAcceleration();
const oldInfo = yaml.load(fs.readFileSync(path.join(oldDir, 'latest.yml'), 'utf8'));
const nextInfo = yaml.load(fs.readFileSync(path.join(nextDir, 'latest.yml'), 'utf8'));
const oldName = oldInfo.files[0].url, nextName = nextInfo.files[0].url;
let server;

app.whenReady().then(async () => {
  const report = { oldVersion: oldInfo.version, targetVersion: nextInfo.version,
    installerBytes: nextInfo.files[0].size, installed: false, trials: [] };
  for (const missingOldMap of [false, true]) {
    const trialDir = path.join(output, missingOldMap ? 'fallback' : 'differential');
    if (fs.existsSync(trialDir)) throw new Error(`Use a fresh output directory: ${trialDir}`);
    fs.mkdirSync(path.join(trialDir, 'cache'), { recursive: true });
    fs.mkdirSync(path.join(trialDir, 'user-data'), { recursive: true });
    // Seed the prerequisite that a normal NSIS installation keeps in its updater cache.
    fs.copyFileSync(path.join(oldDir, oldName), path.join(trialDir, 'cache', 'installer.exe'));
    const requests = [], logs = [];
    server = http.createServer((req, res) => {
      const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname.slice(1));
      const routes = new Map([
        ['latest.yml', path.join(nextDir, 'latest.yml')],
        [nextName, path.join(nextDir, nextName)],
        [`${nextName}.blockmap`, path.join(nextDir, `${nextName}.blockmap`)],
        ...(!missingOldMap ? [[`${oldName}.blockmap`, path.join(oldDir, `${oldName}.blockmap`)]] : []),
      ]);
      const file = routes.get(name);
      if (!file) { requests.push({ name, status: 404, bytes: 0 }); res.writeHead(404); res.end(); return; }
      const size = fs.statSync(file).size;
      const range = req.headers.range && /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
      if (req.headers.range && !range) { res.writeHead(416); res.end(); return; }
      const start = range ? Number(range[1]) : 0;
      const end = range && range[2] ? Number(range[2]) : size - 1;
      if (start > end || end >= size) { res.writeHead(416); res.end(); return; }
      const entry = { name, status: range ? 206 : 200, range: req.headers.range || null, bytes: 0 };
      requests.push(entry);
      res.writeHead(entry.status, { 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
      const stream = fs.createReadStream(file, { start, end });
      stream.on('data', (chunk) => { entry.bytes += chunk.length; });
      stream.on('error', (error) => res.destroy(error));
      stream.pipe(res);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    const configPath = path.join(trialDir, 'app-update.yml');
    fs.writeFileSync(configPath, JSON.stringify({ provider: 'generic', url, updaterCacheDirName: 'cache' }));
    const adapter = { version: oldInfo.version, name: 'Ddx update verification', isPackaged: true,
      appUpdateConfigPath: configPath, userDataPath: path.join(trialDir, 'user-data'), baseCachePath: trialDir,
      whenReady: () => app.whenReady(), quit: () => { throw new Error('Installation is prohibited in this harness'); },
      relaunch: () => { throw new Error('Relaunch is prohibited in this harness'); }, onQuit: () => {} };
    const updater = new NsisUpdater(null, adapter);
    updater.httpExecutor = new ElectronHttpExecutor();
    updater.setFeedURL({ provider: 'generic', url, useMultipleRangeRequest: false });
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.disableWebInstaller = true;
    updater.disableDifferentialDownload = false;
    updater.logger = Object.fromEntries(['info', 'warn', 'error'].map((level) => [level, (value) => logs.push(`[${level}] ${value}`)]));
    let progress;
    updater.on('download-progress', (value) => { progress = value; });
    await updater.checkForUpdates();
    const files = await updater.downloadUpdate();
    const hash = crypto.createHash('sha512').update(fs.readFileSync(files[0])).digest('base64');
    if (hash !== nextInfo.files[0].sha512) throw new Error('Reconstructed installer hash mismatch');
    const installerResponses = requests.filter((entry) => entry.name === nextName);
    const installerTransferred = installerResponses.reduce((sum, entry) => sum + entry.bytes, 0);
    const fallback = logs.find((line) => line.includes('fallback to full download'));
    if (!missingOldMap && (fallback || !installerResponses.some((entry) => entry.status === 206))) throw new Error('Expected a real differential range download');
    if (missingOldMap && (!fallback || !installerResponses.some((entry) => entry.status === 200))) throw new Error('Expected full download fallback');
    const trial = { missingOldBlockmap: missingOldMap, installerTransferred,
      totalResponseBodyBytes: requests.reduce((sum, entry) => sum + entry.bytes, 0),
      sdkProgress: progress, sha512Verified: true, fallbackReason: fallback || null, requests };
    report.trials.push(trial);
    fs.writeFileSync(path.join(trialDir, 'updater.log'), logs.join('\n'));
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
  }
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  app.exit(0);
}).catch((error) => {
  fs.writeFileSync(path.join(output, 'error.txt'), error.stack || String(error));
  server?.close();
  app.exit(1);
});
