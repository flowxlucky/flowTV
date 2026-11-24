import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { DEFAULT_USER_AGENT } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 默认短剧源
const DEFAULT_SHORT_DRAMA_API = 'https://wwzy.tv/api.php/provide/vod';

// 从单个源获取短剧分类
async function getCategoriesFromSource(api: string): Promise<{ type_id: number; type_name: string }[]> {
  try {
    const response = await fetch(`${api}?ac=list`, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const categories = data.class || [];

    // 严格筛选包含"短剧"的分类，杜绝将其他非短剧视频分类混入
    const shortDramaCategories = categories.filter((cat: any) =>
      cat?.type_name && cat.type_name.includes('短剧')
    );

    if (shortDramaCategories.length > 0) {
      return shortDramaCategories.map((cat: any) => ({
        type_id: cat.type_id,
        type_name: cat.type_name.trim(),
      }));
    }

    return [];
  } catch (e) {
    console.warn(`获取源 ${api} 分类失败:`, e);
    return [];
  }
}

// 从配置的短剧源获取分类
async function getShortDramaCategoriesInternal() {
  const config = await getConfig();

  // 筛选出所有启用的短剧源
  const shortDramaSources = config.SourceConfig.filter(
    source => source.type === 'shortdrama' && !source.disabled
  );

  // 如果有配置短剧源，从配置的源获取分类
  if (shortDramaSources.length > 0) {
    console.log(`📋 [CATEGORIES] 从 ${shortDramaSources.length} 个配置的短剧源获取分类`);

    const results = await Promise.allSettled(
      shortDramaSources.map(source => {
        console.log(`  → 尝试源: ${source.name} (${source.api})`);
        return getCategoriesFromSource(source.api);
      })
    );

    // 合并所有成功的结果并去重
    const allCategories: { type_id: number; type_name: string }[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        console.log(`  ✅ 源 ${shortDramaSources[index].name} 返回 ${result.value.length} 个分类`);
        allCategories.push(...result.value);
      } else if (result.status === 'rejected') {
        console.log(`  ❌ 源 ${shortDramaSources[index].name} 失败:`, result.reason?.message);
      }
    });

    if (allCategories.length > 0) {
      // 严格按名称去重，避免多个视频源产生重复的同名分类（如出现10个"短剧"）
      const categoryMap = new Map<string, { type_id: number; type_name: string }>();
      for (const cat of allCategories) {
        const name = cat.type_name?.trim();
        if (name && !categoryMap.has(name)) {
          categoryMap.set(name, {
            type_id: cat.type_id,
            type_name: name,
          });
        }
      }
      const uniqueCategories = Array.from(categoryMap.values());
      // 排序优化：若有纯"短剧"或"全部短剧"，置顶在最前
      uniqueCategories.sort((a, b) => {
        if (a.type_name === '短剧') return -1;
        if (b.type_name === '短剧') return 1;
        return a.type_name.localeCompare(b.type_name, 'zh-CN');
      });
      return uniqueCategories;
    }

    console.log('⚠️ 所有配置的短剧源都未返回分类，回退到默认源');
  }

  // 没有配置短剧源或全部失败，使用默认源
  console.log(`📋 [CATEGORIES] 使用默认短剧源: ${DEFAULT_SHORT_DRAMA_API}`);
  const defaultCats = await getCategoriesFromSource(DEFAULT_SHORT_DRAMA_API);
  if (defaultCats.length > 0) {
    const categoryMap = new Map<string, { type_id: number; type_name: string }>();
    for (const cat of defaultCats) {
      const name = cat.type_name?.trim();
      if (name && !categoryMap.has(name)) {
        categoryMap.set(name, {
          type_id: cat.type_id,
          type_name: name,
        });
      }
    }
    return Array.from(categoryMap.values());
  }
  // 兜底返回一个默认短剧分类
  return [{ type_id: 1, type_name: '短剧' }];
}

export async function GET() {
  try {
    const categories = await getShortDramaCategoriesInternal();

    // 设置与网页端一致的缓存策略（categories: 4小时）
    const response = NextResponse.json(categories);

    console.log('🕐 [CATEGORIES] 设置4小时HTTP缓存 - 与网页端categories缓存一致');

    // 4小时 = 14400秒（与网页端SHORTDRAMA_CACHE_EXPIRE.categories一致）
    const cacheTime = 14400;
    response.headers.set('Cache-Control', `public, max-age=${cacheTime}, s-maxage=${cacheTime}`);
    response.headers.set('CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    response.headers.set('Vercel-CDN-Cache-Control', `public, s-maxage=${cacheTime}`);

    // 调试信息
    response.headers.set('X-Cache-Duration', '4hour');
    response.headers.set('X-Cache-Expires-At', new Date(Date.now() + cacheTime * 1000).toISOString());
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());

    // Vary头确保不同设备有不同缓存
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');

    return response;
  } catch (error) {
    console.error('获取短剧分类失败:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
