import path from 'path';

/** NSIS owns the install directory and can remove its contents during replacement. */
export function assertDataOutsideInstallDirectory(installDirectory: string, dataPaths: string[]): void {
  for (const location of dataPaths) {
    const relative = path.relative(path.resolve(installDirectory), path.resolve(location));
    if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('Update postponed: user data or media is inside the application installation folder. Move it outside that folder before applying an update.');
    }
  }
}
