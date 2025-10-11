import React, { memo } from 'react';
import { Droplets } from 'lucide-react';

interface IndividualTankCardProps {
  tankName: string;
  tankType: 'upper' | 'lower';
  level: number;
  isActive: boolean;
  className?: string;
}

export const IndividualTankCard: React.FC<IndividualTankCardProps> = memo(({
  tankName,
  tankType,
  level,
  isActive,
  className = ''
}) => {
  const getLevelColor = (level: number) => {
    if (level >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    if (level >= 50) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
    if (level >= 20) return 'text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-300';
    return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
  };

  const getLevelBarColor = (level: number) => {
    if (level >= 80) return 'bg-green-500';
    if (level >= 50) return 'bg-yellow-500';
    if (level >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTankTypeColor = (type: 'upper' | 'lower') => {
    return type === 'upper' ? 'text-blue-500' : 'text-purple-500';
  };

  const getTankTypeLabel = (type: 'upper' | 'lower') => {
    return type === 'upper' ? 'Upper Tank' : 'Lower Tank';
  };

  // Don't render if sensor is not active
  if (!isActive) {
    return null;
  }

  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700
      p-6 transition-all duration-300 hover:shadow-xl
      ${className}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Droplets className={`w-5 h-5 ${getTankTypeColor(tankType)}`} />
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {tankName} - {getTankTypeLabel(tankType)}
          </h3>
        </div>
        <div className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          Active
        </div>
      </div>

      {/* Tank Level */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Water Level
          </span>
          <span className={`
            text-sm font-bold px-2 py-1 rounded-full
            ${getLevelColor(level)}
          `}>
            {level}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all duration-500 ${getLevelBarColor(level)}`}
            style={{ width: `${Math.min(100, Math.max(0, level))}%` }}
          />
        </div>
      </div>

      {/* Level Indicator */}
      <div className="flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span>Low</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <span>Medium</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span>High</span>
        </div>
      </div>
    </div>
  );
});
