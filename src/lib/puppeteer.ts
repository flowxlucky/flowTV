/**
 * 轻量化 Puppeteer 适配桩
 * 已剔除体积庞大的 @sparticuz/chromium 与 puppeteer-core 依赖（节省 500MB+ 镜像空间）
 * 系统自动无缝走官方轻量 API (fetchFromMobileAPI)，运行极其平稳省内存
 */

export async function getBrowser(): Promise<any> {
  throw new Error('Chromium/Puppeteer 已轻量化移除，系统使用原生 Mobile API');
}

export async function fetchPageWithPuppeteer(
  _url: string,
  _options?: any
): Promise<string> {
  throw new Error('Chromium/Puppeteer 已轻量化移除，系统使用原生 Mobile API');
}

export async function bypassDoubanChallenge(
  _url: string,
  _maxRetries?: number
): Promise<{
  html: string;
  cookies?: Record<string, string>;
}> {
  // 返回空 html，调用方会自动 fallback 到 fetchFromMobileAPI
  return { html: '' };
}
