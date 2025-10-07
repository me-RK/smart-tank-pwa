import React from 'react';
import { Check } from 'lucide-react';

interface SensorCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'red';
}

export const SensorCheckbox: React.FC<SensorCheckboxProps> = ({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  color = 'blue'
}) => {
  const colorClasses = {
    blue: checked ? 'bg-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600',
    green: checked ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600',
    purple: checked ? 'bg-purple-500 border-purple-500' : 'border-gray-300 dark:border-gray-600',
    red: checked ? 'bg-red-500 border-red-500' : 'border-gray-300 dark:border-gray-600'
  };

  return (
    <div className={`
      flex items-start space-x-3 p-4 rounded-lg border-2 transition-all duration-200
      ${checked ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
    `}>
      <button
        type="button"
        className={`
          ${colorClasses[color]}
          w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        `}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="checkbox"
        aria-checked={checked}
      >
        {checked && (
          <Check className="w-3 h-3 text-white" />
        )}
      </button>
      
      <div className="flex-1 min-w-0">
        <label className="block text-sm font-medium text-gray-800 dark:text-gray-200 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};
