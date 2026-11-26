import { NextRequest, NextResponse } from 'next/server';

import { getCacheTime, getConfig } from '@/lib/config';
import { rewriteUrlDomain } from '@/lib/domain-rewrite';
import { recordRequest, getDbQueryCount, resetDbQueryCount } from '@/lib/performance-monitor';
import { DEFAULT_USER_AGENT } from '@/lib/user-agent';

// 强制动态路由，禁用所有缓存
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// 从单个短剧源获取数据（通过分类名称查找）
async function fetchListFromSource(
  api: string,
  page: number,
  size: number,
  categoryName?: string,
  picDomain?: string
) {
  try {
    // Step 1: 获取分类列表，找到"短剧"分类的ID
    const listUrl = `${api}?ac=list`;

    const listResponse = await fetch(listUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!listResponse.ok) {
      throw new Error(`HTTP error! status: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const categories = listData.class || [];

    // 优先按选中的短剧子分类名称匹配，否则查找包含"短剧"的分类
    let shortDramaCategory = null;
    if (categoryName && categoryName !== '全部' && categoryName !== '短剧') {
      shortDramaCategory = categories.find((cat: any) => cat.type_name === categoryName);
    }
    if (!shortDramaCategory) {
      shortDramaCategory = categories.find((cat: any) =>
        cat.type_name && cat.type_name.includes('短剧')
      );
    }

    if (!shortDramaCategory) {
      return { list: [], hasMore: false, total: 0, totalPages: 1 };
    }

    const categoryId = shortDramaCategory.type_id;

    // Step 2: 获取该分类的短剧列表
    const apiUrl = `${api}?ac=detail&t=${categoryId}&pg=${page}`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const items = data.list || [];

    const limitedItems = items.slice(0, size);

    const list = limitedItems.map((item: any) => ({
      id: item.vod_id,
      name: item.vod_name,
      cover: rewriteUrlDomain(item.vod_pic || '', picDomain),
      update_time: item.vod_time || new Date().toISOString(),
      score: parseFloat(item.vod_score) || 0,
      episode_count: parseInt(item.vod_remarks?.replace(/[^\d]/g, '') || '1'),
      description: item.vod_content || item.vod_blurb || '',
      author: item.vod_actor || '',
      backdrop: rewriteUrlDomain(item.vod_pic_slide || item.vod_pic || '', picDomain),
      vote_average: parseFloat(item.vod_score) || 0,
    }));

    const pageCount = Number(data.pagecount) || 1;
    const totalCount = Number(data.total) || 0;
    const hasMore = Number(data.page) < pageCount;

    return {
      list,
      hasMore,
      total: totalCount,
      totalPages: pageCount,
    };
  } catch (err) {
    console.warn(`从源 ${api} 获取短剧列表失败:`, err);
    return { list: [], hasMore: false, total: 0, totalPages: 1 };
  }
}

// 服务端专用函数，支持指定单一站源或聚合所有短剧源
async function getShortDramaListInternal(
  category: number,
  page = 1,
  size = 20,
  categoryName?: string,
  sourceKey?: string
) {
  try {
    const config = await getConfig();

    // 若指定了单一来源站，直接从该来源站获取短剧
    if (sourceKey && sourceKey !== 'all') {
      const targetSource = (config.SourceConfig || []).find(
        (s) => s.key === sourceKey && !s.disabled && s.api?.trim()
      );
      if (targetSource) {
        console.log(`📋 [LIST] 从指定站源获取短剧: ${targetSource.name} (${targetSource.api})`);
        return await fetchListFromSource(
          targetSource.api,
          page,
          size,
          categoryName,
          targetSource.pic_domain
        );
      }
    }

    // 筛选出所有启用的短剧源
    let shortDramaSources = config.SourceConfig.filter(
      source => source.type === 'shortdrama' && !source.disabled
    );

    // 如果未单独配置 shortdrama 源，优先使用所有启用源
    if (shortDramaSources.length === 0) {
      shortDramaSources = config.SourceConfig.filter(
        source => !source.disabled && source.api?.trim()
      ).slice(0, 6);
    }

    // 如果没有配置短剧源，使用默认源
    if (shortDramaSources.length === 0) {
      return await fetchListFromSource(
        'https://wwzy.tv/api.php/provide/vod',
        page,
        size,
        categoryName
      );
    }

    // 聚合源数据
    const results = await Promise.allSettled(
      shortDramaSources.map(source => {
        return fetchListFromSource(source.api, page, size, categoryName, source.pic_domain);
      })
    );

    // 合并所有成功的结果
    const allItems: any[] = [];
    let hasMore = false;
    let maxTotalPages = 1;
    let maxTotalItems = 0;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allItems.push(...result.value.list);
        hasMore = hasMore || result.value.hasMore;
        if (result.value.totalPages > maxTotalPages) maxTotalPages = result.value.totalPages;
        if (result.value.total > maxTotalItems) maxTotalItems = result.value.total;
      }
    });

    // 去重
    const uniqueItems = Array.from(
      new Map(allItems.map(item => [item.name, item])).values()
    );

    // 按更新时间排序
    uniqueItems.sort((a, b) =>
      new Date(b.update_time).getTime() - new Date(a.update_time).getTime()
    );

    return {
      list: uniqueItems.slice(0, size),
      hasMore,
      total: maxTotalItems,
      totalPages: maxTotalPages,
    };
  } catch (error) {
    console.error('获取短剧列表失败:', error);
    try {
      return await fetchListFromSource(
        'https://wwzy.tv/api.php/provide/vod',
        page,
        size,
        categoryName
      );
    } catch (fallbackError) {
      console.error('默认源也失败:', fallbackError);
      return { list: [], hasMore: false, total: 0, totalPages: 1 };
    }
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  resetDbQueryCount();

  try {
    const { searchParams } = request.nextUrl;
    const categoryId = searchParams.get('categoryId');
    const categoryName = searchParams.get('categoryName') || '';
    const sourceKey = searchParams.get('sourceKey') || 'all';
    const page = searchParams.get('page');
    const size = searchParams.get('size');

    // 详细日志记录
    console.log('🚀 [SHORTDRAMA API] 收到请求:', {
      timestamp: new Date().toISOString(),
      categoryId,
      categoryName,
      sourceKey,
      page,
      size,
      userAgent: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      url: request.url
    });

    const category = categoryId ? parseInt(categoryId) : 1;
    const pageNum = page ? parseInt(page) : 1;
    const pageSize = size ? parseInt(size) : 24;

    if (isNaN(category) || isNaN(pageNum) || isNaN(pageSize)) {
      const errorResponse = { error: '参数格式错误' };
      const responseSize = Buffer.byteLength(JSON.stringify(errorResponse), 'utf8');

      recordRequest({
        timestamp: startTime,
        method: 'GET',
        path: '/api/shortdrama/list',
        statusCode: 400,
        duration: Date.now() - startTime,
        memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        dbQueries: getDbQueryCount(),
        requestSize: 0,
        responseSize,
      });

      return NextResponse.json(errorResponse, { status: 400 });
    }

    const result = await getShortDramaListInternal(category, pageNum, pageSize, categoryName, sourceKey);

    // 记录返回的数据
    console.log('✅ [SHORTDRAMA API] 返回数据:', {
      timestamp: new Date().toISOString(),
      count: result.list?.length || 0,
      firstItem: result.list?.[0] ? {
        id: result.list[0].id,
        name: result.list[0].name,
        update_time: result.list[0].update_time
      } : null,
      hasMore: result.hasMore
    });

    // 设置与网页端一致的缓存策略（lists: 2小时）
    const response = NextResponse.json(result);

    console.log('🕐 [LIST] 设置2小时HTTP缓存 - 与网页端lists缓存一致');

    // 2小时 = 7200秒（与网页端SHORTDRAMA_CACHE_EXPIRE.lists一致）
    const cacheTime = 7200;
    response.headers.set('Cache-Control', `public, max-age=${cacheTime}, s-maxage=${cacheTime}`);
    response.headers.set('CDN-Cache-Control', `public, s-maxage=${cacheTime}`);
    response.headers.set('Vercel-CDN-Cache-Control', `public, s-maxage=${cacheTime}`);

    // 调试信息
    response.headers.set('X-Cache-Duration', '2hour');
    response.headers.set('X-Cache-Expires-At', new Date(Date.now() + cacheTime * 1000).toISOString());
    response.headers.set('X-Debug-Timestamp', new Date().toISOString());

    // Vary头确保不同设备有不同缓存
    response.headers.set('Vary', 'Accept-Encoding, User-Agent');

    // 记录性能指标
    const responseSize = Buffer.byteLength(JSON.stringify(result), 'utf8');
    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/shortdrama/list',
      statusCode: 200,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: getDbQueryCount(),
      requestSize: 0,
      responseSize,
      filter: `category:${categoryId}|page:${pageNum}|size:${pageSize}|count:${result.list?.length || 0}`,
    });

    return response;
  } catch (error) {
    console.error('获取短剧列表失败:', error);

    const errorResponse = { error: '服务器内部错误' };
    const responseSize = Buffer.byteLength(JSON.stringify(errorResponse), 'utf8');

    recordRequest({
      timestamp: startTime,
      method: 'GET',
      path: '/api/shortdrama/list',
      statusCode: 500,
      duration: Date.now() - startTime,
      memoryUsed: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
      dbQueries: getDbQueryCount(),
      requestSize: 0,
      responseSize,
    });

    return NextResponse.json(errorResponse, { status: 500 });
  }
}