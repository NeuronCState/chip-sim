import { describe, it, expect } from 'vitest';
import { StorageManager } from '../core/StorageManager';

describe('StorageManager', () => {
  describe('formatBytes', () => {
    it('应正确格式化字节数', () => {
      expect(StorageManager.formatBytes(500)).toBe('500 B');
    });

    it('应正确格式化 KB', () => {
      expect(StorageManager.formatBytes(1024)).toBe('1.0 KB');
      expect(StorageManager.formatBytes(2048)).toBe('2.0 KB');
    });

    it('应正确格式化 MB', () => {
      expect(StorageManager.formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(StorageManager.formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('应正确处理小数 KB', () => {
      expect(StorageManager.formatBytes(1536)).toBe('1.5 KB');
    });

    it('应正确处理 0 字节', () => {
      expect(StorageManager.formatBytes(0)).toBe('0 B');
    });

    it('应正确处理边界值 1023', () => {
      expect(StorageManager.formatBytes(1023)).toBe('1023 B');
    });
  });

  // 注：由于 StorageManager 依赖 IndexedDB（浏览器环境），
  // 以下测试验证类的结构和类型正确性
  describe('类结构验证', () => {
    it('应有正确的静态方法', () => {
      expect(typeof StorageManager.formatBytes).toBe('function');
    });

    it('应导出单例实例', async () => {
      const { storageManager } = await import('../core/StorageManager');
      expect(storageManager).toBeDefined();
      expect(typeof storageManager.init).toBe('function');
      expect(typeof storageManager.saveProject).toBe('function');
      expect(typeof storageManager.getProject).toBe('function');
      expect(typeof storageManager.deleteProject).toBe('function');
      expect(typeof storageManager.listProjects).toBe('function');
      expect(typeof storageManager.setMeta).toBe('function');
      expect(typeof storageManager.getMeta).toBe('function');
    });
  });
});
