import fs from 'fs';
import path from 'path';

export function redactUpdaterMessage(value: unknown): string {
  const message = value instanceof Error ? value.stack || value.message : String(value);
  return message.replace(/https?:\/\/[^\s"<>]+/gi, (raw) => {
    try {
      const url = new URL(raw);
      url.username = ''; url.password = ''; url.hash = '';
      if (url.search) url.search = '?redacted';
      return url.toString();
    } catch { return '[redacted URL]'; }
  }).replace(/(authorization|cookie|set-cookie)\s*[:=][^\r\n]+/gi, '$1: [redacted]')
    .replace(/\b(Bearer|Basic)\s+\S+/gi, '$1 [redacted]')
    .replace(/((?:token|password|secret|signature|api[_-]?key)\s*[=:]\s*)[^\s&,;]+/gi, '$1[redacted]');
}

export function createUpdaterLogger(directory: string) {
  const write = (level: string, values: unknown[]) => {
    const line = `${new Date().toISOString()} [${level}] ${values.map(redactUpdaterMessage).join(' ')}\n`;
    try {
      fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, 'updater.log');
      if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024) {
        fs.copyFileSync(file, `${file}.previous`);
        fs.writeFileSync(file, '');
      }
      fs.appendFileSync(file, line);
    } catch { console.warn('[Updater] Could not write diagnostic log.'); }
  };
  return {
    info: (...values: unknown[]) => write('info', values),
    warn: (...values: unknown[]) => write('warn', values),
    error: (...values: unknown[]) => write('error', values),
  };
}
