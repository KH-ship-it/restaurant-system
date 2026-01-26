// i18n/routing.ts
export const routing = {
  locales: ['en', 'vi', 'ja'] as const,
  defaultLocale: 'en' as const,
  localePrefix: 'always' as const,
  localeDetection: false, // Tắt auto detect để force dựa vào prefix (test)
} as const;