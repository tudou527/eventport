import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const pages: Array<{
    path: string;
    changeFrequency: 'weekly' | 'monthly' | 'yearly';
    priority: number;
  }> = [
    { path: '/', changeFrequency: 'weekly', priority: 1 },
    { path: '/agent/dsh/', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/agent/pi/', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/agent/exec/', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/legal/privacy/', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/legal/terms/', changeFrequency: 'yearly', priority: 0.3 },
  ];

  return pages.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
