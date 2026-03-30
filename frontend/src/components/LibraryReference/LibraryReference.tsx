/** 库函数速查面板 — 搜索 + 分类 + 点击插入代码 */
import { useState, useMemo, useCallback } from 'react';
import { Segmented } from '../../ui/Segmented';
import { useInsertCodeStore } from '../../stores/insert-code-store';
import type { LibEntry } from '../../lib/reference';
import {
  stm32HalFunctions,
  arduinoApiFunctions,
  mcs51Registers,
  searchReferences,
} from '../../lib/reference';
import './LibraryReference.css';

type Platform = 'stm32' | 'arduino' | 'mcs51';

/** 生成速查 Markdown 字符串（供 CodeEditor 虚拟文件使用） */
export function generateReferenceMarkdown(): string {
  const sections: string[] = [];
  sections.push('# 📖 库函数速查手册\n');

  const platformData: { name: string; entries: typeof stm32HalFunctions }[] = [
    { name: 'STM32 HAL', entries: stm32HalFunctions },
    { name: 'Arduino', entries: arduinoApiFunctions },
    { name: 'MCS-51', entries: mcs51Registers },
  ];

  for (const platform of platformData) {
    sections.push(`\n## ${platform.name}\n`);
    const categories = new Map<string, typeof stm32HalFunctions>();
    for (const entry of platform.entries) {
      if (!categories.has(entry.category)) categories.set(entry.category, []);
      categories.get(entry.category)!.push(entry);
    }
    for (const [cat, entries] of categories) {
      sections.push(`### ${cat}\n`);
      for (const entry of entries) {
        sections.push(`#### ${entry.name}\n`);
        sections.push(`${entry.description}\n`);
        sections.push('```c');
        sections.push(entry.signature);
        sections.push('```\n');
        if (entry.params && entry.params.length > 0) {
          sections.push('**参数：**');
          for (const p of entry.params) {
            sections.push(`- \`${p.name}\` — ${p.desc}`);
          }
          sections.push('');
        }
        if (entry.returns) {
          sections.push(`**返回值：** ${entry.returns}\n`);
        }
        sections.push('**示例：**');
        sections.push('```c');
        sections.push(entry.example);
        sections.push('```\n');
        sections.push('---\n');
      }
    }
  }

  return sections.join('\n');
}

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'stm32', label: 'STM32 HAL' },
  { value: 'arduino', label: 'Arduino' },
  { value: 'mcs51', label: 'MCS-51' },
];

const PLATFORM_DATA: Record<Platform, LibEntry[]> = {
  stm32: stm32HalFunctions,
  arduino: arduinoApiFunctions,
  mcs51: mcs51Registers,
};

interface Props {
  /** 可选：点击插入时的额外回调（如显示 toast） */
  onInsert?: (code: string) => void;
}

export function LibraryReference({ onInsert }: Props) {
  const [platform, setPlatform] = useState<Platform>('stm32');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('全部');

  const insertCode = useInsertCodeStore((s) => s.insertCode);

  // 搜索
  const results = useMemo(() => {
    if (query.trim()) {
      return searchReferences(query, platform);
    }
    return PLATFORM_DATA[platform];
  }, [query, platform]);

  // 分类列表
  const categories = useMemo(() => {
    const cats = new Set<string>();
    PLATFORM_DATA[platform].forEach(e => cats.add(e.category));
    return ['全部', ...Array.from(cats)];
  }, [platform]);

  // 分类筛选
  const filtered = useMemo(() => {
    if (activeCategory === '全部') return results;
    return results.filter(e => e.category === activeCategory);
  }, [results, activeCategory]);

  // 插入代码
  const handleInsert = useCallback((entry: LibEntry) => {
    insertCode(entry.example);
    if (onInsert) {
      onInsert(entry.example);
    }
  }, [insertCode, onInsert]);

  // 切换平台时重置筛选
  const handlePlatformChange = (p: Platform) => {
    setPlatform(p);
    setActiveCategory('全部');
    setQuery('');
    setExpandedId(null);
  };

  return (
    <div className="lib-ref">
      {/* 顶部：平台选择 */}
      <div className="lib-ref-header">
        <Segmented
          options={PLATFORM_OPTIONS}
          value={platform}
          onChange={handlePlatformChange}
        />
      </div>

      {/* 搜索框 */}
      <div className="lib-ref-search">
        <input
          className="lib-ref-search-input"
          type="text"
          placeholder="搜索函数 / 寄存器 / 关键词..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="lib-ref-search-clear" onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </div>

      {/* 分类标签 */}
      {!query && (
        <div className="lib-ref-categories">
          {categories.map(cat => (
            <button
              key={cat}
              className={`lib-ref-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 结果列表 */}
      <div className="lib-ref-list">
        {filtered.length === 0 ? (
          <div className="lib-ref-empty">
            <span className="lib-ref-empty-icon">🔍</span>
            <span>无匹配结果</span>
          </div>
        ) : (
          filtered.map(entry => {
            const isExpanded = expandedId === entry.name;
            return (
              <div key={entry.name} className={`lib-ref-item ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="lib-ref-item-header"
                  onClick={() => setExpandedId(isExpanded ? null : entry.name)}
                >
                  <div className="lib-ref-item-title">
                    <span className="lib-ref-item-name">{entry.name}</span>
                    <span className="lib-ref-item-cat">{entry.category}</span>
                  </div>
                  <span className="lib-ref-item-arrow">{isExpanded ? '▼' : '▶'}</span>
                </div>
                <div className="lib-ref-item-desc">{entry.description}</div>

                {isExpanded && (
                  <div className="lib-ref-detail">
                    <div className="lib-ref-signature">
                      <code>{entry.signature}</code>
                    </div>

                    {entry.params && entry.params.length > 0 && (
                      <div className="lib-ref-params">
                        <div className="lib-ref-section-title">参数</div>
                        {entry.params.map(p => (
                          <div key={p.name} className="lib-ref-param">
                            <span className="lib-ref-param-name">{p.name}</span>
                            <span className="lib-ref-param-desc">{p.desc}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {entry.returns && (
                      <div className="lib-ref-returns">
                        <span className="lib-ref-section-title">返回值: </span>
                        <span>{entry.returns}</span>
                      </div>
                    )}

                    <div className="lib-ref-example">
                      <div className="lib-ref-section-title">示例</div>
                      <pre className="lib-ref-code">
                        <code>{entry.example}</code>
                      </pre>
                      {(
                        <button
                          className="lib-ref-insert-btn"
                          onClick={() => handleInsert(entry)}
                        >
                          📥 插入到编辑器
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 底部计数 */}
      <div className="lib-ref-footer">
        {filtered.length} 个条目
        {query && <span> · 搜索: "{query}"</span>}
      </div>
    </div>
  );
}
