import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  sortDirection: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}

export default function SortableTableHeader({
  label,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  className = '',
}: SortableTableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  
  return (
    <th 
      className={`cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <div className="flex flex-col ml-1">
          <ChevronUp 
            className={`h-3 w-3 -mb-1 ${
              isActive && sortDirection === 'asc' 
                ? 'text-blue-600' 
                : 'text-gray-400'
            }`}
          />
          <ChevronDown 
            className={`h-3 w-3 -mt-1 ${
              isActive && sortDirection === 'desc' 
                ? 'text-blue-600' 
                : 'text-gray-400'
            }`}
          />
        </div>
      </div>
    </th>
  );
}

export function useSortableData<T>(
  data: T[],
  defaultSortKey: string | null = null,
  defaultDirection: 'asc' | 'desc' = 'asc'
) {
  const [sortConfig, setSortConfig] = React.useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({
    key: defaultSortKey,
    direction: defaultDirection,
  });

  React.useEffect(() => {
    // Load sort preferences from localStorage
    const savedSort = localStorage.getItem('tableSortConfig');
    if (savedSort) {
      try {
        const parsed = JSON.parse(savedSort);
        setSortConfig(parsed);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
  }, []);

  const handleSort = React.useCallback((key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    const newConfig = { key, direction };
    setSortConfig(newConfig);
    
    // Save to localStorage
    localStorage.setItem('tableSortConfig', JSON.stringify(newConfig));
  }, [sortConfig]);

  const sortedData = React.useMemo(() => {
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aValue = getNestedProperty(a, sortConfig.key!);
      const bValue = getNestedProperty(b, sortConfig.key!);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  return {
    sortedData,
    sortConfig,
    handleSort,
  };
}

function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}