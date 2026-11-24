import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const config = await getConfig();

    // 筛选出所有启用的源
    const allEnabledSources = (config.SourceConfig || []).filter(
      (s) => !s.disabled && s.api?.trim()
    );

    // 优先排在前面的是短剧专属源，然后是通用源
    const shortDramaSources = allEnabledSources.filter(
      (s) => s.type === 'shortdrama'
    );
    const normalSources = allEnabledSources.filter(
      (s) => s.type !== 'shortdrama'
    );

    const merged = [...shortDramaSources, ...normalSources];

    const sources = [
      { key: 'all', name: '🌟 全部聚合', api: '' },
      ...merged.map((s) => ({
        key: s.key,
        name: s.name,
        api: s.api,
        type: s.type || 'normal',
      })),
    ];

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('获取短剧来源站列表失败:', error);
    return NextResponse.json(
      { error: '获取来源站列表失败', sources: [{ key: 'all', name: '🌟 全部聚合', api: '' }] },
      { status: 500 }
    );
  }
}
