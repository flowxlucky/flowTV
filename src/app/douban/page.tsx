/* eslint-disable no-console,react-hooks/exhaustive-deps,@typescript-eslint/no-explicit-any */

'use client';

import { ChevronUp } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

import { isAIRecommendFeatureDisabled } from '@/lib/ai-recommend.client';
import { GetBangumiCalendarData } from '@/lib/bangumi.client';
import {
  getDoubanCategories,
  getDoubanList,
  getDoubanRecommends,
} from '@/lib/douban.client';
import { DoubanItem, DoubanResult } from '@/lib/types';

import DoubanCardSkeleton from '@/components/DoubanCardSkeleton';
import DoubanCustomSelector from '@/components/DoubanCustomSelector';
import DoubanSelector from '@/components/DoubanSelector';
import PageLayout from '@/components/PageLayout';
import Pagination from '@/components/Pagination';
import VideoCard from '@/components/VideoCard';

// 统一每页条数：25条
const PAGE_SIZE = 25;

function DoubanPageClient() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type') || 'movie';

  const [doubanData, setDoubanData] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | undefined>(undefined);
  const [selectorsReady, setSelectorsReady] = useState(false);

  // 返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 智能防抖追踪
  const isFirstMountRef = useRef(true);
  const prevTypeRef = useRef<string>(type);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCacheKeyRef = useRef<string | null>(null);

  // 获取 runtimeConfig 中的自定义分类数据
  const [customCategories, setCustomCategories] = useState<
    Array<{ name: string; type: 'movie' | 'tv'; query: string }>
  >([]);

  // 选择器状态 - 完全独立
  const [primarySelection, setPrimarySelection] = useState<string>(() => {
    if (type === 'movie') return '热门';
    if (type === 'tv' || type === 'show') return '最近热门';
    if (type === 'anime') return '每日放送';
    return '';
  });
  const [secondarySelection, setSecondarySelection] = useState<string>(() => {
    if (type === 'movie') return '全部';
    if (type === 'tv') return 'tv';
    if (type === 'show') return 'show';
    return '全部';
  });

  // MultiLevelSelector 状态
  const [multiLevelValues, setMultiLevelValues] = useState<Record<string, string>>({
    type: 'all',
    region: 'all',
    year: 'all',
    platform: 'all',
    label: 'all',
    sort: 'T',
  });

  // 星期选择器状态
  const [selectedWeekday, setSelectedWeekday] = useState<string>('');

  // 页面级别的AI权限检测状态
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiCheckComplete, setAiCheckComplete] = useState(false);

  // 生成骨架屏数据
  const skeletonData = Array.from({ length: PAGE_SIZE }, (_, index) => index);

  // 获取自定义分类数据
  useEffect(() => {
    const runtimeConfig = (window as any).RUNTIME_CONFIG;
    if (runtimeConfig?.CUSTOM_CATEGORIES?.length > 0) {
      setCustomCategories(runtimeConfig.CUSTOM_CATEGORIES);
    }
  }, []);

  // 页面级别的AI权限检测
  useEffect(() => {
    const disabled = isAIRecommendFeatureDisabled();
    setAiEnabled(!disabled);
    setAiCheckComplete(true);
  }, []);

  // 初始化选择器准备就绪
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // 监听滚动位置，控制返回顶部按钮显示
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setShowBackToTop(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // 当type变化时重置选择器状态
  useEffect(() => {
    setSelectorsReady(false);
    setLoading(true);

    if (type === 'custom' && customCategories.length > 0) {
      const types = Array.from(new Set(customCategories.map((cat) => cat.type)));
      if (types.length > 0) {
        let selectedType = types[0];
        if (types.includes('movie')) {
          selectedType = 'movie';
        } else {
          selectedType = 'tv';
        }
        setPrimarySelection(selectedType);

        const firstCategory = customCategories.find((cat) => cat.type === selectedType);
        if (firstCategory) {
          setSecondarySelection(firstCategory.query);
        }
      }
    } else {
      if (type === 'movie') {
        setPrimarySelection('热门');
        setSecondarySelection('全部');
      } else if (type === 'tv') {
        setPrimarySelection('最近热门');
        setSecondarySelection('tv');
      } else if (type === 'show') {
        setPrimarySelection('最近热门');
        setSecondarySelection('show');
      } else if (type === 'anime') {
        setPrimarySelection('每日放送');
        setSecondarySelection('全部');
      } else {
        setPrimarySelection('');
        setSecondarySelection('全部');
      }
    }

    setMultiLevelValues({
      type: 'all',
      region: 'all',
      year: 'all',
      platform: 'all',
      label: 'all',
      sort: 'T',
    });

    const timer = setTimeout(() => {
      setSelectorsReady(true);
    }, 50);

    return () => clearTimeout(timer);
  }, [type, customCategories]);

  // 生成API请求参数的辅助函数
  const getRequestParams = useCallback(
    (pageStart: number) => {
      if (type === 'tv' || type === 'show') {
        return {
          kind: 'tv' as const,
          category: type,
          type: secondarySelection,
          pageLimit: PAGE_SIZE,
          pageStart,
        };
      }

      return {
        kind: type as 'tv' | 'movie',
        category: primarySelection,
        type: secondarySelection,
        pageLimit: PAGE_SIZE,
        pageStart,
      };
    },
    [type, primarySelection, secondarySelection]
  );

  // 标准单页加载数据函数
  const loadPageData = useCallback(
    async (targetPage: number) => {
      const pageStart = (targetPage - 1) * PAGE_SIZE;
      const cacheKey = `${type}-${primarySelection}-${secondarySelection}-${selectedWeekday}-${JSON.stringify(
        multiLevelValues
      )}-page${targetPage}`;

      if (pendingCacheKeyRef.current === cacheKey) {
        return;
      }
      pendingCacheKeyRef.current = cacheKey;

      try {
        setLoading(true);
        let data: DoubanResult;

        if (type === 'custom') {
          const selectedCategory = customCategories.find(
            (cat) => cat.type === primarySelection && cat.query === secondarySelection
          );

          if (selectedCategory) {
            data = await getDoubanList({
              tag: selectedCategory.query,
              type: selectedCategory.type,
              pageLimit: PAGE_SIZE,
              pageStart,
            });
          } else {
            throw new Error('没有找到对应的分类');
          }
        } else if (type === 'anime' && primarySelection === '每日放送') {
          const calendarData = await GetBangumiCalendarData();
          const weekdayData = calendarData.find(
            (item) => item.weekday.en === selectedWeekday
          );
          if (weekdayData) {
            data = {
              code: 200,
              message: 'success',
              list: weekdayData.items.map((item) => ({
                id: item.id?.toString() || '',
                title: item.name_cn || item.name,
                poster:
                  item.images?.large ||
                  item.images?.common ||
                  item.images?.medium ||
                  item.images?.small ||
                  item.images?.grid ||
                  '/placeholder-poster.jpg',
                rate: item.rating?.score?.toFixed(1) || '',
                year: item.air_date?.split('-')?.[0] || '',
              })),
              total: weekdayData.items.length,
            };
          } else {
            throw new Error('没有找到对应的日期');
          }
        } else if (type === 'anime') {
          data = await getDoubanRecommends({
            kind: primarySelection === '番剧' ? 'tv' : 'movie',
            pageLimit: PAGE_SIZE,
            pageStart,
            category: '动画',
            format: primarySelection === '番剧' ? '电视剧' : '',
            region: multiLevelValues.region ? (multiLevelValues.region as string) : '',
            year: multiLevelValues.year ? (multiLevelValues.year as string) : '',
            platform: multiLevelValues.platform
              ? (multiLevelValues.platform as string)
              : '',
            sort: multiLevelValues.sort ? (multiLevelValues.sort as string) : '',
            label: multiLevelValues.label ? (multiLevelValues.label as string) : '',
          });
        } else if (primarySelection === '全部') {
          data = await getDoubanRecommends({
            kind: type === 'show' ? 'tv' : (type as 'tv' | 'movie'),
            pageLimit: PAGE_SIZE,
            pageStart,
            category: multiLevelValues.type ? (multiLevelValues.type as string) : '',
            format: type === 'show' ? '综艺' : type === 'tv' ? '电视剧' : '',
            region: multiLevelValues.region ? (multiLevelValues.region as string) : '',
            year: multiLevelValues.year ? (multiLevelValues.year as string) : '',
            platform: multiLevelValues.platform
              ? (multiLevelValues.platform as string)
              : '',
            sort: multiLevelValues.sort ? (multiLevelValues.sort as string) : '',
            label: multiLevelValues.label ? (multiLevelValues.label as string) : '',
          });
        } else {
          data = await getDoubanCategories(getRequestParams(pageStart));
        }

        if (data.code === 200) {
          const list = data.list || [];
          setDoubanData(list);

          // 计算总页数和总数
          if (typeof data.total === 'number' && data.total > 0) {
            setTotalItems(data.total);
            setTotalPages(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
          } else if (list.length >= PAGE_SIZE) {
            setTotalItems(undefined);
            setTotalPages((prev) => Math.max(prev, targetPage + 1));
          } else {
            setTotalItems(undefined);
            setTotalPages(targetPage);
          }
        } else {
          throw new Error(data.message || '获取数据失败');
        }
      } catch (err) {
        console.error('[Douban] 获取列表失败:', err);
        setDoubanData([]);
      } finally {
        setLoading(false);
        if (pendingCacheKeyRef.current === cacheKey) {
          pendingCacheKeyRef.current = null;
        }
      }
    },
    [
      type,
      primarySelection,
      secondarySelection,
      multiLevelValues,
      selectedWeekday,
      getRequestParams,
      customCategories,
    ]
  );

  // 监听筛选条件变化，重置并加载第1页（带智能防抖）
  useEffect(() => {
    if (!selectorsReady) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    const isTypeChanged = prevTypeRef.current !== type;
    const shouldExecuteImmediately = isFirstMountRef.current || isTypeChanged;

    if (isFirstMountRef.current) isFirstMountRef.current = false;
    if (isTypeChanged) prevTypeRef.current = type;

    if (shouldExecuteImmediately) {
      setCurrentPage(1);
      loadPageData(1);
    } else {
      debounceTimeoutRef.current = setTimeout(() => {
        setCurrentPage(1);
        loadPageData(1);
      }, 100);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    selectorsReady,
    type,
    primarySelection,
    secondarySelection,
    multiLevelValues,
    selectedWeekday,
    loadPageData,
  ]);

  // 页码切换事件
  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || loading) return;
    setCurrentPage(newPage);
    loadPageData(newPage);

    // 平滑滚动回顶部
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // 选择器变化回调
  const handlePrimaryChange = useCallback(
    (value: string) => {
      if (value !== primarySelection) {
        setLoading(true);
        setCurrentPage(1);
        setDoubanData([]);

        setMultiLevelValues({
          type: 'all',
          region: 'all',
          year: 'all',
          platform: 'all',
          label: 'all',
          sort: 'T',
        });

        if (type === 'custom' && customCategories.length > 0) {
          const firstCategory = customCategories.find((cat) => cat.type === value);
          if (firstCategory) {
            setPrimarySelection(value);
            setSecondarySelection(firstCategory.query);
          } else {
            setPrimarySelection(value);
          }
        } else {
          if ((type === 'tv' || type === 'show') && value === '最近热门') {
            setPrimarySelection(value);
            if (type === 'tv') {
              setSecondarySelection('tv');
            } else if (type === 'show') {
              setSecondarySelection('show');
            }
          } else {
            setPrimarySelection(value);
          }
        }
      }
    },
    [primarySelection, type, customCategories]
  );

  const handleSecondaryChange = useCallback(
    (value: string) => {
      if (value !== secondarySelection) {
        setLoading(true);
        setCurrentPage(1);
        setDoubanData([]);
        setSecondarySelection(value);
      }
    },
    [secondarySelection]
  );

  const handleMultiLevelChange = useCallback(
    (values: Record<string, string>) => {
      setLoading(true);
      setCurrentPage(1);
      setDoubanData([]);
      setMultiLevelValues(values);
    },
    []
  );

  const handleWeekdayChange = useCallback((weekday: string) => {
    setSelectedWeekday(weekday);
  }, []);

  const getPageTitle = () => {
    return type === 'movie'
      ? '电影'
      : type === 'tv'
        ? '电视剧'
        : type === 'anime'
          ? '动漫'
          : type === 'show'
            ? '综艺'
            : '自定义';
  };

  const getPageDescription = () => {
    if (type === 'anime' && primarySelection === '每日放送') {
      return '来自 Bangumi 番组计划的精选内容';
    }
    return '来自豆瓣的精选内容';
  };

  const getActivePath = () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    const queryString = params.toString();
    return `/douban${queryString ? `?${queryString}` : ''}`;
  };

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <PageLayout activePath={getActivePath()}>
      <div className='overflow-visible -mt-6 md:mt-0 pb-20'>
        {/* 页面标题和选择器 */}
        <div className='mb-6 sm:mb-8 space-y-4 sm:space-y-6'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2 dark:text-gray-200'>
              {getPageTitle()}
            </h1>
            <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>
              {getPageDescription()}
            </p>
          </div>

          {/* 选择器组件 */}
          {type !== 'custom' ? (
            <div className='relative bg-linear-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
              <div className='absolute -top-20 -right-20 w-40 h-40 bg-linear-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-linear-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='relative'>
                <DoubanSelector
                  type={type as 'movie' | 'tv' | 'show' | 'anime'}
                  primarySelection={primarySelection}
                  secondarySelection={secondarySelection}
                  onPrimaryChange={handlePrimaryChange}
                  onSecondaryChange={handleSecondaryChange}
                  onMultiLevelChange={handleMultiLevelChange}
                  onWeekdayChange={handleWeekdayChange}
                />
              </div>
            </div>
          ) : (
            <div className='relative bg-linear-to-br from-white/80 via-blue-50/30 to-purple-50/30 dark:from-gray-800/60 dark:via-blue-900/20 dark:to-purple-900/20 rounded-2xl p-4 sm:p-6 border border-blue-200/40 dark:border-blue-700/40 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300'>
              <div className='absolute -top-20 -right-20 w-40 h-40 bg-linear-to-br from-blue-300/20 to-purple-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='absolute -bottom-20 -left-20 w-40 h-40 bg-linear-to-br from-green-300/20 to-teal-300/20 rounded-full blur-3xl pointer-events-none'></div>
              <div className='relative'>
                <DoubanCustomSelector
                  customCategories={customCategories}
                  primarySelection={primarySelection}
                  secondarySelection={secondarySelection}
                  onPrimaryChange={handlePrimaryChange}
                  onSecondaryChange={handleSecondaryChange}
                />
              </div>
            </div>
          )}
        </div>

        {/* 内容展示区域（标准受限单页展示，彻底移除 VirtualGrid 虚拟滚动与下拉无限滚动） */}
        <div className='max-w-[95%] mx-auto mt-8 overflow-visible min-h-[480px]'>
          {loading || !selectorsReady ? (
            <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
              {skeletonData.map((index) => (
                <DoubanCardSkeleton key={index} />
              ))}
            </div>
          ) : doubanData.length > 0 ? (
            <div className='justify-start grid grid-cols-3 gap-x-2 gap-y-12 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-8 sm:gap-y-20'>
              {doubanData.map((item, index) => {
                const mappedType =
                  type === 'movie'
                    ? 'movie'
                    : type === 'show'
                      ? 'variety'
                      : type === 'tv'
                        ? 'tv'
                        : type === 'anime'
                          ? 'anime'
                          : '';
                return (
                  <div key={`${item.title}-${index}`} className='w-full'>
                    <VideoCard
                      from='douban'
                      source='douban'
                      id={item.id}
                      source_name='豆瓣'
                      title={item.title}
                      poster={item.poster}
                      douban_id={Number(item.id)}
                      rate={item.rate}
                      year={item.year}
                      type={mappedType}
                      isBangumi={type === 'anime' && primarySelection === '每日放送'}
                      aiEnabled={aiEnabled}
                      aiCheckComplete={aiCheckComplete}
                      priority={index < 25}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='flex justify-center py-16'>
              <div className='relative px-12 py-10 rounded-3xl bg-linear-to-br from-gray-50 via-slate-50 to-gray-100 dark:from-gray-800/40 dark:via-slate-800/40 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 shadow-xl backdrop-blur-sm overflow-hidden max-w-md'>
                <div className='relative flex flex-col items-center gap-4 text-center'>
                  <div className='w-20 h-20 rounded-full bg-linear-to-br from-blue-100 to-slate-200 dark:from-blue-900/40 dark:to-slate-700 flex items-center justify-center shadow-md'>
                    <span className='text-3xl'>🎬</span>
                  </div>
                  <div className='space-y-2'>
                    <h3 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                      暂无相关内容
                    </h3>
                    <p className='text-sm text-gray-600 dark:text-gray-400 max-w-xs'>
                      尝试调整筛选条件或切换其他分类查看更多内容
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 标准受限分页条（与搜索界面和源浏览器界面完全一致） */}
          {!loading && totalPages > 1 && (
            <div className='flex justify-center mt-12 mb-8'>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalItems={totalItems}
                onPageChange={handlePageChange}
                className='shadow-xs'
              />
            </div>
          )}
        </div>
      </div>

      {/* 返回顶部悬浮按钮 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-50 w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回顶部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
      </button>
    </PageLayout>
  );
}

export default function DoubanPage() {
  return (
    <Suspense>
      <DoubanPageClient />
    </Suspense>
  );
}
