export interface PublicEntrypoint {
  file: string;
  path: string;
  title: string;
  description: string;
}

export const PUBLIC_ENTRYPOINTS: readonly PublicEntrypoint[];

export function renderPublicEntrypoint(indexHtml: string, entry: PublicEntrypoint): string;
