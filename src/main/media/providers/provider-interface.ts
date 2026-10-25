import { MediaProviderType } from '../../../types';

export interface MediaProvider {
  id: MediaProviderType;
  name: string;
  canHandle(url: string): boolean;
  cleanUrl(url: string): string;
  isPlaylist(url: string): boolean;
}
