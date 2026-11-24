/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps, no-console */

'use client';

import { ChevronUp, Filter, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getShortDramaCategories,
  getShortDramaList,
  searchShortDramas,
} from '@/lib/shortdrama.client';
import { cleanExpiredCache } from '@/lib/shortdrama-cache';
import { ShortDramaCategory, ShortDramaItem } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import Pagination from '@/components/Pagination';
import ShortDramaCard from '@/components/ShortDramaCard';

// 统一每页条数：24条（手机端2列、平板3-4列、PC端5-6列均可完美整除整行对齐）
const PAGE_SIZE = 24;

export default function ShortDramaPage() {
  const [categories, setCategories] = useState<ShortDramaCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('');
  const [dramas, setDramas] = useState<ShortDramaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  // 返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 骨架屏占位数据
  const skeletonArray = Array.from({ length: PAGE_SIZE }, (_, i) => i);

  // 获取分类列表
  useEffect(() => {
    cleanExpiredCache().catch(console.error);

    const fetchCategories = async () => {
      const cats = await getShortDramaCategories();
      setCategories(cats);
      // 自动选中第一个分类
      if (cats.length > 0 && !selectedCategory) {
        setSelectedCategory(cats[0].type_id);
        setSelectedCategoryName(cats[0].type_name);
      }
    };
    fetchCategories();
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

  // 加载短剧列表（标准单页受限加载）
  const loadDramas = useCallback(
    async (pageNum: number) => {
      if (!selectedCategory && !isSearchMode) return;

      setLoading(true);
      try {
        let result: {
          list: ShortDramaItem[];
          hasMore: boolean;
          total?: number;
          totalPages?: number;
        };

        if (isSearchMode && searchQuery.trim()) {
          result = await searchShortDramas(searchQuery.trim(), pageNum, PAGE_SIZE);
        } else {
          result = await getShortDramaList(
            selectedCategory!,
            pageNum,
            PAGE_SIZE,
            selectedCategoryName
          );
        }

        const list = result.list || [];
        setDramas(list);

        // 计算总页数
        if (result.totalPages && result.totalPages > 0) {
          setTotalPages(result.totalPages);
        } else if (result.total && result.total > 0) {
          setTotalPages(Math.ceil(result.total / PAGE_SIZE));
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
        console.error('加载短剧失败:', error);
        setDramas([]);
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, selectedCategoryName, searchQuery, isSearchMode]
  );

  // 当分类或搜索模式发生变化时，重置回第1页并重新加载
  useEffect(() => {
    if (selectedCategory && !isSearchMode) {
      setPage(1);
      loadDramas(1);
    }
  }, [selectedCategory, selectedCategoryName, isSearchMode]);

  // 当页码改变时加载对应页数据
  const handlePageChange = (newPage: number) => {
    if (newPage === page || loading) return;
    setPage(newPage);
    loadDramas(newPage);

    // 页面回滚至顶部
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  // 搜索处理
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const hasQuery = Boolean(query.trim());
    setIsSearchMode(hasQuery);
    setPage(1);

    if (hasQuery) {
      setLoading(true);
      searchShortDramas(query.trim(), 1, PAGE_SIZE)
        .then((result) => {
          setDramas(result.list || []);
          if (result.totalPages) setTotalPages(result.totalPages);
          else if (result.hasMore) setTotalPages(2);
          else setTotalPages(1);
          setTotalItems(result.total);
        })
        .catch((err) => {
          console.error('搜索短剧失败:', err);
          setDramas([]);
        })
        .finally(() => setLoading(false));
    }
  };

  // 选择分类
  const handleSelectCategory = (cat: ShortDramaCategory) => {
    if (selectedCategory === cat.type_id && !isSearchMode) return;
    setSelectedCategory(cat.type_id);
    setSelectedCategoryName(cat.type_name);
    setIsSearchMode(false);
    setSearchQuery('');
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
              精彩短剧，品质精选
            </p>
          </div>

          {/* 搜索栏 */}
          <div className="mb-6">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-all duration-300 group-focus-within:text-purple-500 dark:group-focus-within:text-purple-400 group-focus-within:scale-110" />
              <input
                type="text"
                placeholder="搜索短剧名称..."
                className="w-full rounded-xl border border-gray-200 bg-white/80 pl-11 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent focus:bg-white shadow-xs hover:shadow-md focus:shadow-lg dark:bg-gray-800/80 dark:text-white dark:placeholder-gray-500 dark:border-gray-700 dark:focus:bg-gray-800 dark:focus:ring-purple-500 transition-all duration-300"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* 分类筛选（去重并归拢后显示） */}
          {!isSearchMode && categories.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-linear-to-br from-purple-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Filter className="h-4 w-4 text-white" />
                </div>
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                  分类筛选
                </span>
                <div className="flex-1"></div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-medium">
                  {categories.length} 个分类
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {categories.map((category, index) => {
                  const isSelected = selectedCategory === category.type_id;
                  return (
                    <button
                      key={`${category.type_id}-${category.type_name}-${index}`}
                      onClick={() => handleSelectCategory(category)}
                      className={`group relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300 transform hover:scale-105 ${
                        isSelected
                          ? 'bg-linear-to-r from-purple-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/40'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md'
                      }`}
                    >
                      {/* 激活状态的光泽效果 */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      )}
                      {!isSelected && (
                        <div className="absolute inset-0 bg-linear-to-r from-purple-50 via-pink-50 to-purple-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-purple-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      )}
                      <span className="relative z-10">{category.type_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 短剧标准网格（彻底移除不稳定与导致空白Bug的 VirtualGrid，使用现代原生 CSS Grid） */}
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
                      {isSearchMode ? '未找到相关短剧' : '暂无短剧数据'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isSearchMode
                        ? '请尝试换用其他关键词或切换分类'
                        : '当前分类暂无数据，可点击其他分类查看'}
                    </p>
                    {isSearchMode && (
                      <button
                        onClick={() => handleSearch('')}
                        className="mt-2 px-5 py-2 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium shadow-md hover:scale-105 transition-all"
                      >
                        清空搜索
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 标准受限分页条（与源浏览器界面与搜索界面完全一致） */}
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
