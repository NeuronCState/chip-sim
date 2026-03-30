import type { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  prefix?: string;
  suffix?: string;
  clearable?: boolean;
  onClear?: () => void;
}

export function Input({
  label,
  prefix,
  suffix,
  clearable,
  onClear,
  className,
  value,
  ...rest
}: InputProps) {
  return (
    <div className={`${styles.wrapper} ${className ?? ''}`}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.inputRow}>
        {prefix && <span className={styles.prefix}>{prefix}</span>}
        <input className={styles.input} value={value} {...rest} />
        {clearable && value && (
          <button
            className={styles.clearBtn}
            onClick={onClear}
            type="button"
            aria-label="Clear"
          >
            ✕
          </button>
        )}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
    </div>
  );
}
