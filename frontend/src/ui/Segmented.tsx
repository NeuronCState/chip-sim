import type { ReactNode } from 'react';
import styles from './Segmented.module.css';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={`${styles.segmented} ${className ?? ''}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          className={`${styles.segment} ${opt.value === value ? styles.active : ''}`}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.icon && <span>{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
