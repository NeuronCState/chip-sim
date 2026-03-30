import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Panel({ className, children, ...rest }: PanelProps) {
  return (
    <div className={`${styles.panel} ${className ?? ''}`} {...rest}>
      <div className={styles.panelContent}>{children}</div>
    </div>
  );
}
