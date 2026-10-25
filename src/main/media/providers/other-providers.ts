import { MediaProvider } from './provider-interface';
import { MediaProviderType } from '../../../types';

export class InstagramProvider implements MediaProvider {
  public id: MediaProviderType = 'instagram';
  public name = 'Instagram';

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host === 'instagram.com' || host.endsWith('.instagram.com');
    } catch {
      return false;
    }
  }

  public cleanUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.search = '';
      return parsed.toString();
    } catch {
      return url;
    }
  }

  public isPlaylist(_url: string): boolean {
    return false;
  }
}

export class VimeoProvider implements MediaProvider {
  public id: MediaProviderType = 'vimeo';
  public name = 'Vimeo';

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host === 'vimeo.com' || host.endsWith('.vimeo.com');
    } catch {
      return false;
    }
  }

  public cleanUrl(url: string): string {
    return url;
  }

  public isPlaylist(url: string): boolean {
    return url.includes('/showcase/') || url.includes('/album/');
  }
}

export class TikTokProvider implements MediaProvider {
  public id: MediaProviderType = 'tiktok';
  public name = 'TikTok';

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host === 'tiktok.com' || host.endsWith('.tiktok.com');
    } catch {
      return false;
    }
  }

  public cleanUrl(url: string): string {
    return url;
  }

  public isPlaylist(_url: string): boolean {
    return false;
  }
}

export class GenericProvider implements MediaProvider {
  public id: MediaProviderType = 'generic';
  public name = 'Web Media';

  public canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  public cleanUrl(url: string): string {
    return url;
  }

  public isPlaylist(_url: string): boolean {
    return false;
  }
}
