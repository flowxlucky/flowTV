/**
 * 视频源域名替换工具
 * 兼容：带/不带协议的新域名（如 fqm3u8.cc 或 https://fqm3u8.cc），
 * 完整保留原链接路径与查询参数；支持绝对 URL、协议相对 URL（//）和相对路径。
 */

interface ParsedTargetDomain {
  hasProtocol: boolean;
  protocol: string; // e.g. 'https:'
  host: string;     // e.g. 'fqm3u8.cc' or 'fqm3u8.cc:8443'
}

function parseTargetDomain(rawDomain?: string): ParsedTargetDomain | null {
  const trimmed = rawDomain?.trim();
  if (!trimmed) return null;

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const candidate = hasProtocol ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.host) return null;
    return {
      hasProtocol,
      protocol: parsed.protocol,
      host: parsed.host,
    };
  } catch {
    const host = trimmed.replace(/^https?:\/\//i, '').split('/')[0]?.trim();
    if (!host) return null;
    return {
      hasProtocol,
      protocol: /^http:\/\//i.test(trimmed) ? 'http:' : 'https:',
      host,
    };
  }
}

/**
 * 替换单个 URL 的域名，保留路径、查询参数与哈希。
 */
export function rewriteUrlDomain(url: string, newDomain?: string): string {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl) return url;

  const target = parseTargetDomain(newDomain);
  if (!target) return url;

  // 标准 http/https URL
  if (/^https?:\/\//i.test(trimmedUrl)) {
    try {
      const parsed = new URL(trimmedUrl);
      parsed.host = target.host;
      if (target.hasProtocol) {
        parsed.protocol = target.protocol;
      }
      return parsed.toString();
    } catch {
      return trimmedUrl.replace(
        /^(https?:\/\/)([^/?#]+)/i,
        (_, origProto: string) =>
          `${target.hasProtocol ? `${target.protocol}//` : origProto}${target.host}`
      );
    }
  }

  // 协议相对 URL (//example.com/path)
  if (trimmedUrl.startsWith('//')) {
    const protoPrefix = target.hasProtocol ? `${target.protocol}//` : '//';
    return trimmedUrl.replace(/^\/\/[^/?#]+/, `${protoPrefix}${target.host}`);
  }

  // 相对路径 (/upload/vod/1.jpg 或 upload/vod/1.jpg)
  const proto = target.hasProtocol ? target.protocol : 'https:';
  const pathPart = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
  return `${proto}//${target.host}${pathPart}`;
}

/**
 * 替换 MacCMS 格式的 vod_play_url 字符串中所有播放链接的域名
 * 格式示例：正片$https://old.com/1.m3u8#第2集$https://old.com/2.m3u8$$$备用$...
 */
export function rewriteVodPlayUrl(vodPlayUrl: string, playDomain?: string): string {
  if (!vodPlayUrl || !playDomain?.trim()) return vodPlayUrl;

  return vodPlayUrl
    .split('$$$')
    .map((group) =>
      group
        .split('#')
        .map((entry) => {
          const dollarIdx = entry.indexOf('$');
          if (dollarIdx !== -1) {
            const title = entry.slice(0, dollarIdx);
            const link = entry.slice(dollarIdx + 1);
            return `${title}$${rewriteUrlDomain(link, playDomain)}`;
          }
          if (/^(https?:)?\/\//i.test(entry.trim())) {
            return rewriteUrlDomain(entry, playDomain);
          }
          return entry;
        })
        .join('#')
    )
    .join('$$$');
}
