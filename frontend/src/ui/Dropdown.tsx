import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import styles from './Dropdown.module.css';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
}

export interface DropdownProps<T extends string = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  renderOption?: (option: DropdownOption<T>) => ReactNode;
}

export function Dropdown<T extends string = string>({
  options,
  value,
  onChange,
  placeholder = '请选择',
  className,
  renderOption,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className={`${styles.wrapper} ${className ?? ''}`} ref={ref}>
      <button
        className={`${styles.trigger} ${open ? styles.open : ''}`}
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span>{selected?.label ?? placeholder}</span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▼</span>
      </button>
      {open && (
        <div className={styles.menu}>
          {options.map(opt => (
            <button
              key={opt.value}
              className={`${styles.option} ${opt.value === value ? styles.optionActive : ''}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              type="button"
            >
              {renderOption ? renderOption(opt) : opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
