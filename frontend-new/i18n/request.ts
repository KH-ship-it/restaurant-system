// i18n/request.ts    ← tên file này đang là chuẩn khuyến nghị mới nhất
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  console.log('Requested locale from middleware:', locale); 
  if (!locale || !['en', 'vi', 'ja'].includes(locale)) {
    locale = 'en';
  }
  console.log('Final locale used:', locale);
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});