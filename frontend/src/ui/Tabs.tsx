import { useState } from 'react';
import type { ReactNode } from 'react';
import styles from './Tabs.module.css';

export interface TabItem {
  key: string;
  label: string;
  content?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeKey?: string;
  onChange?: (key: string) => void;
  className?: string;
  children?: ReactNode;
}

export function Tabs({ items, activeKey, onChange, className, children }: TabsProps) {
  const [internalKey, setInternalKey] = useState(items[0]?.key ?? '');
  const current = activeKey ?? internalKey;

  const handleTab = (key: string) => {
    if (onChange) onChange(key);
    else setInternalKey(key);
  };

  const activeItem = items.find(i => i.key === current);

  return (
    <div className={className}>
      <div className={styles.tabs}>
        {items.map(item => (
          <button
            key={item.key}
            className={`${styles.tab} ${item.key === current ? styles.active : ''}`}
            onClick={() => handleTab(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {(activeItem?.content || children) && (
        <div className={styles.content}>
          {activeItem?.content ?? children}
        </div>
      )}
    </div>
  );
}
