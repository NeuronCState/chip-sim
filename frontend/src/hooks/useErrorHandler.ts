/**
 * useErrorHandler Hook
 * 统一的错误处理逻辑，集成 Toast 通知、错误日志和错误分类
 * 支持网络错误、仿真错误、验证错误、用户操作错误的分类处理
 */

import { useCallback, useState } from 'react';
import { useToast } from './useToast';
import { ApiError } from '../lib/errors/api-client';
import { errorLogger } from '../lib/errors/error-logger';
import {
  createAppError,
  inferErrorCode,
  formatErrorForUser,
  type AppError,
  type ErrorCategory,
} from '../lib/errors/error-types';

/**
 * @example
 * ```tsx
 * const { handleError, isLoading, wrapAsync, appError } = useErrorHandler();
 *
 * const handleSave = wrapAsync(async () => {
 *   await api.post('/save', data);
 * }, '保存项目');
 *
 * // 处理仿真错误
 * const handleSimError = (error: unknown) => {
 *   handleError(error, { category: 'simulation', context: 'DC 仿真' });
 * };
 * ```
 */
export function useErrorHandler() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [appError, setAppError] = useState<AppError | null>(null);

  /**
   * 处理错误并显示通知
   * @param error 捕获的错误
   * @param options 配置项
   */
  const handleError = useCallback(
    (
      error: unknown,
      options: {
        context?: string;
        category?: ErrorCategory;
        showToast?: boolean;
        showDiagnostics?: boolean;
      } = {}
    ) => {
      const {
        context,
        category,
        showToast = true,
        showDiagnostics = false,
      } = options;

      // 推断错误码并创建结构化错误
      const code = inferErrorCode(error);
      const appErr = createAppError(code, error, category ? { category } : undefined);
      setAppError(appErr);

      // 记录到错误日志
      if (error instanceof ApiError) {
        errorLogger.log({
          type: 'api',
          message: error.message,
          statusCode: error.statusCode,
          url: error.url,
          metadata: { method: error.method, kind: error.kind, appErrorCode: code },
        });
      } else if (error instanceof Error) {
        errorLogger.log({
          type: category === 'websocket' ? 'websocket' : 'unknown',
          message: error.message,
          stack: error.stack,
          metadata: { appErrorCode: code, category },
        });
      }

      // 生成用户可见消息
      const userMessage = context
        ? `${context}失败：${appErr.message}`
        : appErr.message;

      // 显示 Toast
      if (showToast) {
        if (appErr.severity === 'critical') {
          toast.error(formatErrorForUser(appErr), 0); // 不自动消失
        } else if (appErr.severity === 'error') {
          toast.error(userMessage, 6000);
        } else if (appErr.severity === 'warning') {
          toast.warning(userMessage, 5000);
        } else {
          toast.info(userMessage);
        }
      }

      // 仿真/严重错误可展示诊断信息
      if (showDiagnostics && appErr.detail) {
        toast.info(`🔍 ${appErr.detail}`, 8000);
        if (appErr.suggestion) {
          setTimeout(() => toast.info(`💡 ${appErr.suggestion}`, 8000), 300);
        }
      }

      return appErr;
    },
    [toast]
  );

  /**
   * 处理仿真错误（带详细诊断）
   */
  const handleSimulationError = useCallback(
    (error: unknown, analysisType?: string) => {
      return handleError(error, {
        context: analysisType ? `${analysisType} 仿真` : '仿真',
        category: 'simulation',
        showDiagnostics: true,
      });
    },
    [handleError]
  );

  /**
   * 处理验证错误
   */
  const handleValidationError = useCallback(
    (message: string) => {
      const appErr = createAppError('VAL_NO_COMPONENTS', undefined, {
        message,
        category: 'validation',
      });
      setAppError(appErr);
      toast.warning(message);
      return appErr;
    },
    [toast]
  );

  /**
   * 包装异步函数，自动处理 loading 状态和错误
   * @param fn 异步操作
   * @param context 操作名称
   * @param options 配置
   */
  const wrapAsync = useCallback(
    <T>(
      fn: () => Promise<T>,
      context?: string,
      options: {
        onSuccess?: (result: T) => void;
        successMessage?: string;
        showSuccessToast?: boolean;
        showErrorToast?: boolean;
        category?: ErrorCategory;
      } = {}
    ) => {
      const {
        onSuccess,
        successMessage,
        showSuccessToast = true,
        showErrorToast = true,
        category,
      } = options;

      return async (): Promise<T | undefined> => {
        setIsLoading(true);
        setAppError(null);
        try {
          const result = await fn();
          if (successMessage && showSuccessToast) {
            toast.success(successMessage);
          }
          onSuccess?.(result);
          return result;
        } catch (error) {
          handleError(error, { context, category, showToast: showErrorToast });
          return undefined;
        } finally {
          setIsLoading(false);
        }
      };
    },
    [handleError, toast]
  );

  /** 清除当前错误 */
  const clearError = useCallback(() => {
    setAppError(null);
  }, []);

  return {
    handleError,
    handleSimulationError,
    handleValidationError,
    wrapAsync,
    isLoading,
    setIsLoading,
    appError,
    clearError,
  };
}
