import { MediaProvider } from './provider-interface';
import { YouTubeProvider } from './youtube-provider';
import { InstagramProvider, VimeoProvider, TikTokProvider, GenericProvider } from './other-providers';

export class ProviderRegistry {
  private providers: MediaProvider[] = [];
  private fallbackProvider: MediaProvider;

  constructor() {
    this.fallbackProvider = new GenericProvider();
    this.registerProvider(new YouTubeProvider());
    this.registerProvider(new InstagramProvider());
    this.registerProvider(new VimeoProvider());
    this.registerProvider(new TikTokProvider());
  }

  public registerProvider(provider: MediaProvider): void {
    this.providers.push(provider);
  }

  /**
   * Validates that the input is a valid, secure public HTTP/HTTPS URL.
   * Disallows local filesystem, javascript:, file:, data:, or invalid formats.
   */
  public validateUrl(rawUrl: string): { valid: boolean; error?: string; cleanUrl?: string } {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { valid: false, error: 'Please provide a valid URL.' };
    }

    const trimmed = rawUrl.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: 'URL cannot be empty.' };
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Only http:// and https:// URLs are permitted.' };
      }

      // Check for localhost or internal private IP ranges to prevent SSRF
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31)
      ) {
        return { valid: false, error: 'Private and local network addresses are not allowed.' };
      }

      return { valid: true, cleanUrl: trimmed };
    } catch {
      return { valid: false, error: 'Invalid URL format.' };
    }
  }

  public getProvider(url: string): MediaProvider {
    for (const provider of this.providers) {
      if (provider.canHandle(url)) {
        return provider;
      }
    }
    return this.fallbackProvider;
  }
}
