/**
 * API 错误拦截器与重试机制
 * 
 * 提供统一的 fetch 封装：
 * - 网络超时检测
 * - HTTP 状态码分类处理（4xx / 5xx）
 * - 自动重试（可配置次数和间隔）
 * - 错误日志收集
 */

import { errorLogger } from './error-logger';

// ==================== 类型定义 ====================

/** API 错误分类 */
export type ApiErrorKind =
  | 'network'       // 网络不通 / DNS 失败
  | 'timeout'       // 请求超时
  | 'client'        // 4xx 客户端错误
  | 'server'        // 5xx 服务端错误
  | 'auth'          // 401/403 认证失败
  | 'unknown';      // 其他

/** 封装后的 API 错误 */
export class ApiError extends Error {
  kind: ApiErrorKind;
  statusCode?: number;
  url: string;
  method: string;
  retryable: boolean;

  constructor(params: {
    message: string;
    kind: ApiErrorKind;
    statusCode?: number;
    url: string;
    method: string;
    retryable?: boolean;
    cause?: Error;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.kind = params.kind;
    this.statusCode = params.statusCode;
    this.url = params.url;
    this.method = params.method;
    this.retryable = params.retryable ?? false;
    if (params.cause) {
      this.cause = params.cause;
    }
  }
}

/** 请求配置 */
export interface ApiRequestConfig extends RequestInit {
  /** 超时时间（ms），默认 30000 */
  timeout?: number;
  /** 最大重试次数，默认 0（不重试） */
  maxRetries?: number;
  /** 重试间隔基数（ms），默认 1000。实际间隔 = baseDelay * 2^attempt */
  retryDelay?: number;
  /** 是否在重试时显示 toast 提示，默认 true */
  showRetryToast?: boolean;
}

/** 请求结果 */
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
}

// ==================== 核心逻辑 ====================

/**
 * 根据 HTTP 状态码分类错误
 */
function classifyError(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status >= 400 && status < 500) return 'client';
  if (status >= 500) return 'server';
  return 'unknown';
}

/**
 * 判断错误是否可重试
 */
function isRetryable(kind: ApiErrorKind, status?: number): boolean {
  if (kind === 'network' || kind === 'timeout') return true;
  if (kind === 'server' && status !== 501) return true; // 501 Not Implemented 不重试
  return false;
}

/**
 * 延迟指定毫秒
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取用户友好的错误消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'network':
        return '网络连接失败，请检查网络设置';
      case 'timeout':
        return '请求超时，请稍后重试';
      case 'auth':
        return error.statusCode === 401 ? '登录已过期，请重新登录' : '权限不足';
      case 'server':
        return '服务器内部错误，请稍后重试';
      case 'client':
        return error.message || '请求参数错误';
      default:
        return error.message || '未知错误';
    }
  }
  if (error instanceof Error) return error.message;
  return '发生未知错误';
}

/**
 * 统一的 API 请求函数
 * 
 * @example
 * ```ts
 * const { data } = await apiFetch<SimulationResult>('/api/simulate', {
 *   method: 'POST',
 *   body: JSON.stringify(circuit),
 *   maxRetries: 2,
 * });
 * ```
 */
export async function apiFetch<T = unknown>(
  url: string,
  config: ApiRequestConfig = {}
): Promise<ApiResponse<T>> {
  const {
    timeout = 30000,
    maxRetries = 0,
    retryDelay = 1000,
    showRetryToast = true,
    ...fetchOptions
  } = config;

  const method = (fetchOptions.method || 'GET').toUpperCase();
  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const waitMs = retryDelay * Math.pow(2, attempt - 1);
      console.log(`[apiFetch] 重试 ${attempt}/${maxRetries}，等待 ${waitMs}ms`);
      await delay(waitMs);
    }

    try {
      // 超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;
      try {
        response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new ApiError({
            message: `请求超时 (${timeout}ms)`,
            kind: 'timeout',
            url,
            method,
            retryable: true,
          });
        }
        throw new ApiError({
          message: `网络错误: ${(err as Error).message}`,
          kind: 'network',
          url,
          method,
          retryable: true,
          cause: err as Error,
        });
      }

      clearTimeout(timeoutId);

      // HTTP 错误处理
      if (!response.ok) {
        const kind = classifyError(response.status);
        let body = '';
        try {
          body = await response.text();
        } catch { /* ignore */ }

        const apiError = new ApiError({
          message: body || `HTTP ${response.status} ${response.statusText}`,
          kind,
          statusCode: response.status,
          url,
          method,
          retryable: isRetryable(kind, response.status),
        });

        // 记录错误日志
        errorLogger.log({
          type: 'api',
          message: apiError.message,
          statusCode: response.status,
          url,
          metadata: { method, attempt, kind },
        });

        if (!apiError.retryable || attempt >= maxRetries) {
          throw apiError;
        }

        lastError = apiError;
        continue;
      }

      // 解析响应
      let data: T;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      return { data, status: response.status, headers: response.headers };

    } catch (err) {
      if (err instanceof ApiError) {
        lastError = err;
        if (!err.retryable || attempt >= maxRetries) {
          throw err;
        }
      } else {
        // 非预期错误
        const apiError = new ApiError({
          message: (err as Error).message || '未知错误',
          kind: 'unknown',
          url,
          method,
          retryable: false,
          cause: err as Error,
        });
        errorLogger.log({
          type: 'api',
          message: apiError.message,
          url,
          metadata: { method, attempt },
        });
        throw apiError;
      }
    }
  }

  throw lastError || new ApiError({
    message: '请求失败',
    kind: 'unknown',
    url,
    method,
  });
}

/**
 * 创建预配置的 API 客户端
 * 
 * @example
 * ```ts
 * const api = createApiClient('http://localhost:8080');
 * const { data } = api.get('/api/projects');
 * ```
 */
export function createApiClient(baseUrl: string, defaultConfig: ApiRequestConfig = {}) {
  const buildUrl = (path: string) =>
    path.startsWith('http') ? path : `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;

  return {
    get: <T = unknown>(path: string, config?: ApiRequestConfig) =>
      apiFetch<T>(buildUrl(path), { ...defaultConfig, method: 'GET', ...config }),

    post: <T = unknown>(path: string, body?: unknown, config?: ApiRequestConfig) =>
      apiFetch<T>(buildUrl(path), {
        ...defaultConfig,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...defaultConfig.headers, ...config?.headers },
        body: body ? JSON.stringify(body) : undefined,
        ...config,
      }),

    put: <T = unknown>(path: string, body?: unknown, config?: ApiRequestConfig) =>
      apiFetch<T>(buildUrl(path), {
        ...defaultConfig,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...defaultConfig.headers, ...config?.headers },
        body: body ? JSON.stringify(body) : undefined,
        ...config,
      }),

    delete: <T = unknown>(path: string, config?: ApiRequestConfig) =>
      apiFetch<T>(buildUrl(path), { ...defaultConfig, method: 'DELETE', ...config }),
  };
}
