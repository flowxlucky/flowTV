/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronUp, Search, Server, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  getShortDramaList,
  searchShortDramas,
} from '@/lib/shortdrama.client';
import { cleanExpiredCache } from '@/lib/shortdrama-cache';
import { ShortDramaItem } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import Pagination from '@/components/Pagination';
import ShortDramaCard from '@/components/ShortDramaCard';

// 统一每页条数：24条
const PAGE_SIZE = 24;

interface SourceItem {
  key: string;
  name: string;
  api: string;
  type?: string;
}

export default function ShortDramaPage() {
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [activeSourceKey, setActiveSourceKey] = useState<string>('all');

  const [dramas, setDramas] = useState<ShortDramaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | undefined>(undefined);

  // 搜索相关状态：分离输入草稿与确认搜索词，彻底杜绝打字过程自动识别
  const [searchDraft, setSearchDraft] = useState('');
  const [confirmedQuery, setConfirmedQuery] = useState('');

  // 返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 骨架屏占位数据
  const skeletonArray = Array.from({ length: PAGE_SIZE }, (_, i) => i);

  // 1. 获取可用来源站列表
  useEffect(() => {
    cleanExpiredCache().catch(console.error);

    const fetchSources = async () => {
      setLoadingSources(true);
      try {
        const res = await fetch('/api/shortdrama/sources', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const list: SourceItem[] = data.sources || [];
          setSources(list);
          if (list.length > 0) {
            setActiveSourceKey(list[0].key);
          }
        }
      } catch (err) {
        console.error('获取短剧来源站失败:', err);
      } finally {
        setLoadingSources(false);
      }
    };

    fetchSources();
  }, []);

  // 2. 监听滚动位置，控制返回顶部按钮显示
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

  // 3. 加载短剧列表
  const loadDramas = useCallback(
    async (pageNum: number, query: string, sourceKey: string) => {
      setLoading(true);
      try {
        let result: {
          list: ShortDramaItem[];
          hasMore: boolean;
          total?: number;
          totalPages?: number;
        };

        const trimmedQuery = query.trim();
        if (trimmedQuery) {
          result = await searchShortDramas(trimmedQuery, pageNum, PAGE_SIZE);
        } else {
          result = await getShortDramaList(
            1,
            pageNum,
            PAGE_SIZE,
            undefined,
            sourceKey
          );
        }

        const list = result.list || [];
        setDramas(list);

        // 计算总页数
        if (result.totalPages && result.totalPages > 0) {
          setTotalPages(result.totalPages);
        } else if (result.total && result.total > 0) {
          setTotalPages(Math.max(1, Math.ceil(result.total / PAGE_SIZE)));
        } else if (result.hasMore) {
          setTotalPages((prev) => Math.max(prev, pageNum + 1));
        } else {
          setTotalPages(pageNum);
        }

        if (typeof result.total === 'number' && result.total > 0) {
          setTotalItems(result.total);
        } else {
          setTotalItems(undefined);
        }
      } catch (error) {
        console.error('加载短剧列表失败:', error);
        setDramas([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 4. 当选中的站源或确认的搜索词改变时，重置回第1页并重新加载
  useEffect(() => {
    setPage(1);
    loadDramas(1, confirmedQuery, activeSourceKey);
  }, [activeSourceKey, confirmedQuery, loadDramas]);

  // 5. 切换来源站
  const handleSelectSource = (key: string) => {
    if (activeSourceKey === key) return;
    setActiveSourceKey(key);
    // 切换来源站时清空搜索，展示该来源站短剧
    setSearchDraft('');
    setConfirmedQuery('');
  };

  // 6. 确认搜索（回车或点击确认按钮触发，输入中不做任何自动识别）
  const handleConfirmSearch = () => {
    const trimmed = searchDraft.trim();
    if (trimmed === confirmedQuery) return;
    setConfirmedQuery(trimmed);
  };

  // 清空搜索输入并立即确认恢复
  const handleClearSearch = () => {
    setSearchDraft('');
    if (confirmedQuery) {
      setConfirmedQuery('');
    }
  };

  // 键盘回车监听（严禁中文输入法敲拼音时误触发）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleConfirmSearch();
    }
  };

  // 7. 分页切换事件
  const handlePageChange = (newPage: number) => {
    if (newPage === page || loading) return;
    setPage(newPage);
    loadDramas(newPage, confirmedQuery, activeSourceKey);

    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // 返回顶部功能
  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const currentSourceName = sources.find((s) => s.key === activeSourceKey)?.name || '短剧站源';

  return (
    <PageLayout activePath="/shortdrama">
      <div className="min-h-screen -mt-6 md:mt-0 pb-20">
        <div>
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              短剧频道
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              按站源精选浏览，畅享精彩短剧
            </p>
          </div>

          {/* 搜索栏：带独立确认按钮，输入过程中不触发搜索 */}
          <div className="mb-6">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1 group">
                <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-all duration-300 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400" />
                <input
                  type="text"
                  placeholder="输入短剧名称并回车或点击确认搜索..."
                  className="w-full rounded-xl border border-gray-200 bg-white/90 pl-11 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent focus:bg-white shadow-xs hover:shadow-md focus:shadow-lg dark:bg-gray-800/90 dark:text-white dark:placeholder-gray-500 dark:border-gray-700 dark:focus:bg-gray-800 dark:focus:ring-purple-500 transition-all duration-300"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                {searchDraft && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="清空输入"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* 显式确认搜索按钮 */}
              <button
                type="button"
                onClick={handleConfirmSearch}
                className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-linear-to-r from-purple-500 via-purple-600 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-200 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>搜索</span>
              </button>
            </div>
          </div>

          {/* 选择来源站一栏（复刻源浏览器图2样式） */}
          <div className="bg-linear-to-br from-white via-emerald-50/30 to-white dark:from-gray-800 dark:via-emerald-900/10 dark:to-gray-800 rounded-2xl shadow-lg border border-gray-200/80 dark:border-gray-700/80 backdrop-blur-sm mb-6">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-semibold text-gray-900 dark:text-white">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span>选择来源站</span>
              </div>
              {!loadingSources && sources.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                  {sources.length} 个
                </span>
              )}
            </div>
            <div className="p-5">
              {loadingSources ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>加载站源列表中...</span>
                </div>
              ) : sources.length === 0 ? (
                <p className="text-sm text-gray-500">暂无可用来源站</p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {sources.map((s) => {
                    const isSelected = activeSourceKey === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => handleSelectSource(s.key)}
                        className={`group relative px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition-all duration-300 transform hover:scale-105 ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/30 font-semibold'
                            : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 搜索提示状态 */}
          {confirmedQuery && (
            <div className="flex items-center justify-between mb-4 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-xl">
              <span className="text-sm text-purple-700 dark:text-purple-300">
                正在展示关键词 <span className="font-bold">“{confirmedQuery}”</span> 的搜索结果
              </span>
              <button
                onClick={handleClearSearch}
                className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 underline font-medium"
              >
                清空搜索，返回【{currentSourceName}】
              </button>
            </div>
          )}

          {/* 短剧卡片网格 */}
          <div className="min-h-[480px]">
            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {skeletonArray.map((idx) => (
                  <div key={idx} className="relative overflow-hidden">
                    <div className="aspect-2/3 w-full rounded-lg bg-linear-to-br from-gray-100 via-gray-200 to-gray-100 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse"></div>
                    <div className="mt-2 h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                    <div className="mt-1 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : dramas.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {dramas.map((drama, index) => (
                  <div key={`${drama.id}-${index}`} className="w-full">
                    <ShortDramaCard drama={drama} priority={index < 12} />
                  </div>
                ))}
              </div>
            ) : (
              /* 无数据展示 */
              <div className="flex justify-center py-16">
                <div className="relative px-12 py-10 rounded-3xl bg-linear-to-br from-gray-50 via-slate-50 to-gray-100 dark:from-gray-800/40 dark:via-slate-800/40 dark:to-gray-800/50 border border-gray-200/50 dark:border-gray-700/50 shadow-xl backdrop-blur-sm overflow-hidden max-w-md">
                  <div className="relative flex flex-col items-center gap-4 text-center">
                    <div className="w-20 h-20 rounded-full bg-linear-to-br from-purple-100 to-slate-200 dark:from-purple-900/40 dark:to-slate-700 flex items-center justify-center shadow-md">
                      <Search className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">
                      {confirmedQuery
                        ? '未找到相关短剧'
                        : `【${currentSourceName}】暂无短剧数据`}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {confirmedQuery
                        ? '请尝试换用其他关键词或切换来源站'
                        : '该来源站未检索到短剧分类，请点击其他来源站查看'}
                    </p>
                    {confirmedQuery && (
                      <button
                        onClick={handleClearSearch}
                        className="mt-2 px-5 py-2 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium shadow-md hover:scale-105 transition-all"
                      >
                        清空搜索条件
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 标准受限分页条 */}
          {!loading && totalPages > 1 && (
            <div className="flex justify-center mt-10 mb-8">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalItems={totalItems}
                onPageChange={handlePageChange}
                className="shadow-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* 返回顶部悬浮按钮 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-50 w-12 h-12 bg-purple-500/90 hover:bg-purple-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label="返回顶部"
      >
        <ChevronUp className="w-6 h-6 transition-transform group-hover:scale-110" />
      </button>
    </PageLayout>
  );
}
