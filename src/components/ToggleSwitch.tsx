import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'purple';
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  size = 'md',
  color = 'blue'
}) => {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-12 h-6',
    lg: 'w-16 h-8'
  };

  const thumbSizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-7 h-7'
  };

  const colorClasses = {
    blue: checked ? 'bg-blue-500' : 'bg-gray-300',
    green: checked ? 'bg-green-500' : 'bg-gray-300',
    red: checked ? 'bg-red-500' : 'bg-gray-300',
    purple: checked ? 'bg-purple-500' : 'bg-gray-300'
  };

  const thumbColorClasses = {
    blue: checked ? 'translate-x-6' : 'translate-x-0',
    green: checked ? 'translate-x-6' : 'translate-x-0',
    red: checked ? 'translate-x-6' : 'translate-x-0',
    purple: checked ? 'translate-x-6' : 'translate-x-0'
  };

  return (
    <div className="flex items-center space-x-3">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <button
        type="button"
        className={`
          ${sizeClasses[size]}
          ${colorClasses[color]}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          relative inline-flex items-center rounded-full transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        `}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`
            ${thumbSizeClasses[size]}
            ${thumbColorClasses[color]}
            bg-white rounded-full shadow-lg transform transition-transform duration-200 ease-in-out
            inline-block
          `}
        />
      </button>
    </div>
  );
};
