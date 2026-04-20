import React from "react";

interface Column<T> {
  // keyof T に限定することで、存在しないプロパティ名をコンパイル時に検出できる
  key: keyof T;
  header: string;
  render?: (row: T) => React.ReactNode;
}

interface TableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  // 各行を一意に識別するキー名。React の差分検知に使用する
  rowKey: keyof T;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  totalCount,
  page,
  pageSize,
  onPageChange,
}: TableProps<T>) {
  // pageSize が 0 以下の場合、Infinity/NaN になるためガードする
  const safePageSize = pageSize > 0 ? pageSize : 1;
  const safeTotalCount = Math.max(0, totalCount);
  // ページ数は totalCount と pageSize から算出する
  const totalPages = Math.ceil(safeTotalCount / safePageSize);
  const hasPagination = totalPages > 1;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={String(column.key)}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-6 py-4 text-center text-gray-500">
                データがありません
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={String(row[rowKey])}>
                {columns.map((column) => (
                  <td
                    key={String(column.key)}
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                  >
                    {column.render ? column.render(row) : String(row[column.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {hasPagination && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            前へ
          </button>
          <span className="text-sm text-gray-700">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  );
}
