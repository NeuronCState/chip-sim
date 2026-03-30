import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    disabled ? styles.disabled : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}
