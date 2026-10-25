import { MediaProvider } from './provider-interface';
import { MediaProviderType } from '../../../types';

export class YouTubeProvider implements MediaProvider {
  public id: MediaProviderType = 'youtube';
  public name = 'YouTube';

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return (
        host === 'youtube.com' ||
        host.endsWith('.youtube.com') ||
        host === 'youtu.be' ||
        host.endsWith('.youtu.be')
      );
    } catch {
      return false;
    }
  }

  public cleanUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove tracking parameters like si, feature, pp, etc. while keeping v and list
      const allowedParams = ['v', 'list', 't', 'index'];
      const searchParams = new URLSearchParams();
      
      for (const param of allowedParams) {
        const val = parsed.searchParams.get(param);
        if (val) searchParams.set(param, val);
      }
      
      parsed.search = searchParams.toString();
      return parsed.toString();
    } catch {
      return url;
    }
  }

  public isPlaylist(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.pathname.includes('/playlist') || (parsed.searchParams.has('list') && !parsed.searchParams.has('v'));
    } catch {
      return false;
    }
  }
}
