'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = 30,
  className = '',
}: PaginationProps) {
  const [inputVal, setInputVal] = useState(String(currentPage));

  useEffect(() => {
    setInputVal(String(currentPage));
  }, [currentPage]);

  if (totalPages <= 1) return null;

  const handleJump = () => {
    let p = parseInt(inputVal, 10);
    if (isNaN(p)) {
      setInputVal(String(currentPage));
      return;
    }
    if (p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    setInputVal(String(p));
    if (p !== currentPage) {
      onPageChange(p);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleJump();
    }
  };

  // 生成智能折叠页码列表
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push('...');
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <nav
      className={`flex flex-wrap items-center justify-center gap-2 py-6 select-none ${className}`}
      aria-label='分页导航'
    >
      {/* 桌面端/通用完整布局 */}
      <div className='flex items-center gap-1.5 sm:gap-2'>
        {/* 上一页 */}
        <button
          type='button'
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-all ${
            currentPage <= 1
              ? 'border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-transparent'
              : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95'
          }`}
          title='上一页'
        >
          <ChevronLeft className='w-4 h-4' />
          <span className='hidden sm:inline'>上一页</span>
        </button>

        {/* 中间页码（手机端精简，PC端展开） */}
        <div className='hidden sm:flex items-center gap-1'>
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`dots-${idx}`}
                  className='px-2 py-1 text-xs text-gray-400'
                >
                  ...
                </span>
              );
            }
            const pageNum = p as number;
            const isActive = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                type='button'
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[32px] h-8 px-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                  isActive
                    ? 'bg-linear-to-r from-emerald-500 to-green-600 text-white shadow-sm font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* 移动端紧凑型页码指示 */}
        <div className='flex sm:hidden items-center text-xs text-gray-600 dark:text-gray-400 px-1 font-medium'>
          {currentPage} / {totalPages}
        </div>

        {/* 下一页 */}
        <button
          type='button'
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg border transition-all ${
            currentPage >= totalPages
              ? 'border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed bg-transparent'
              : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95'
          }`}
          title='下一页'
        >
          <span className='hidden sm:inline'>下一页</span>
          <ChevronRight className='w-4 h-4' />
        </button>
      </div>

      {/* 手填页数 / 总页数 */}
      <div className='flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400 ml-1 sm:ml-3'>
        <input
          type='text'
          inputMode='numeric'
          pattern='[0-9]*'
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={handleJump}
          onKeyDown={handleKeyDown}
          className='w-12 h-8 px-1.5 text-center text-xs sm:text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors shadow-2xs'
          title='输入页码并回车跳转'
        />
        <span>页 / {totalPages} 页</span>
        {typeof totalItems === 'number' && (
          <span className='hidden md:inline text-xs text-gray-400 dark:text-gray-500 ml-1'>
            (共 {totalItems} 部)
          </span>
        )}
      </div>
    </nav>
  );
}

export default Pagination;
