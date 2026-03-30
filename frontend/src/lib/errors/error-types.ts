/**
 * 错误分类与用户友好的中文错误消息
 * 统一管理所有错误类型的中文提示文案
 */

// ==================== 错误分类 ====================

/** 前端错误大类 */
export const ErrorCategory = {
  Network: 'network',           // 网络错误
  Simulation: 'simulation',     // 仿真错误
  Validation: 'validation',     // 验证错误
  UserAction: 'user_action',    // 用户操作错误
  WebSocket: 'websocket',       // WebSocket 错误
  Circuit: 'circuit',           // 电路相关错误
  System: 'system',             // 系统级错误
} as const;
export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

/** 错误严重程度 */
export const ErrorSeverity = {
  Info: 'info',         // 信息提示
  Warning: 'warning',   // 警告
  Error: 'error',       // 错误
  Critical: 'critical', // 严重错误
} as const;
export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

/** 结构化错误 */
export interface AppError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;           // 用户友好的中文消息
  detail?: string;           // 详细说明（可选）
  suggestion?: string;       // 修复建议（可选）
  recoverable: boolean;      // 是否可恢复
  timestamp: number;
  originalError?: unknown;
}

// ==================== 错误码定义 ====================

interface ErrorDef {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  detail?: string;
  suggestion?: string;
  recoverable: boolean;
}

/** 错误码 → 中文消息映射表 */
export const ERROR_DEFINITIONS: Record<string, ErrorDef> = {
  // === 网络错误 ===
  'NET_OFFLINE': {
    category: 'network',
    severity: 'error',
    message: '网络连接已断开',
    detail: '无法连接到服务器，请检查网络设置',
    suggestion: '请检查 Wi-Fi 或网线连接，稍后将自动重试',
    recoverable: true,
  },
  'NET_TIMEOUT': {
    category: 'network',
    severity: 'warning',
    message: '网络请求超时',
    detail: '服务器响应时间过长',
    suggestion: '请检查网络状况，或稍后重试',
    recoverable: true,
  },
  'NET_DNS_FAIL': {
    category: 'network',
    severity: 'error',
    message: '无法解析服务器地址',
    detail: 'DNS 解析失败',
    suggestion: '请检查网络设置或联系管理员',
    recoverable: true,
  },
  'NET_SERVER_ERROR': {
    category: 'network',
    severity: 'error',
    message: '服务器内部错误',
    detail: '服务器处理请求时发生异常',
    suggestion: '请稍后重试，如问题持续请联系管理员',
    recoverable: true,
  },
  'NET_AUTH_EXPIRED': {
    category: 'network',
    severity: 'warning',
    message: '登录已过期',
    detail: '身份认证信息已失效',
    suggestion: '请重新登录',
    recoverable: false,
  },
  'NET_FORBIDDEN': {
    category: 'network',
    severity: 'error',
    message: '权限不足',
    detail: '您没有执行此操作的权限',
    suggestion: '请联系管理员获取相应权限',
    recoverable: false,
  },
  'NET_NOT_FOUND': {
    category: 'network',
    severity: 'warning',
    message: '请求的资源不存在',
    detail: '服务器返回 404 错误',
    suggestion: '请检查请求地址是否正确',
    recoverable: false,
  },

  // === WebSocket 错误 ===
  'WS_DISCONNECTED': {
    category: 'websocket',
    severity: 'warning',
    message: 'WebSocket 连接已断开',
    detail: '与仿真服务器的实时连接中断',
    suggestion: '正在自动尝试重新连接...',
    recoverable: true,
  },
  'WS_RECONNECTING': {
    category: 'websocket',
    severity: 'info',
    message: '正在重新连接...',
    detail: '尝试恢复与仿真服务器的连接',
    suggestion: '请稍候',
    recoverable: true,
  },
  'WS_RECONNECT_FAILED': {
    category: 'websocket',
    severity: 'error',
    message: '重连失败',
    detail: '已达到最大重试次数，无法恢复连接',
    suggestion: '请检查后端服务是否启动，然后手动重新连接',
    recoverable: true,
  },
  'WS_MESSAGE_ERROR': {
    category: 'websocket',
    severity: 'warning',
    message: '消息解析失败',
    detail: '收到无法识别的服务器消息',
    suggestion: '这可能是版本不兼容导致的，请刷新页面重试',
    recoverable: true,
  },

  // === 仿真错误 ===
  'SIM_CONVERGENCE_FAIL': {
    category: 'simulation',
    severity: 'error',
    message: '仿真收敛失败',
    detail: '迭代计算无法收敛到稳定解',
    suggestion: '请尝试减小时间步长、调整元件参数或检查电路拓扑',
    recoverable: true,
  },
  'SIM_SINGULAR_MATRIX': {
    category: 'simulation',
    severity: 'error',
    message: '矩阵奇异，无法求解',
    detail: '电路方程组的系数矩阵不可逆',
    suggestion: '请检查是否存在电压源环路或浮空节点，确保电路拓扑正确',
    recoverable: true,
  },
  'SIM_TIMEOUT': {
    category: 'simulation',
    severity: 'warning',
    message: '仿真执行超时',
    detail: '仿真计算时间超过预期',
    suggestion: '请尝试减小仿真时域或降低精度要求',
    recoverable: true,
  },
  'SIM_MODEL_ERROR': {
    category: 'simulation',
    severity: 'error',
    message: '元件模型错误',
    detail: '某个元件的仿真模型参数不正确',
    suggestion: '请检查各元件的参数值是否在合理范围内',
    recoverable: true,
  },
  'SIM_INTERNAL_ERROR': {
    category: 'simulation',
    severity: 'critical',
    message: '仿真引擎内部错误',
    detail: '后端仿真程序发生未预期的错误',
    suggestion: '请保存当前工作并刷新页面重试。如问题持续，请联系开发团队',
    recoverable: false,
  },
  'SIM_USER_STOPPED': {
    category: 'simulation',
    severity: 'info',
    message: '仿真已停止',
    detail: '用户手动终止了仿真运行',
    suggestion: '可以修改参数后重新启动仿真',
    recoverable: true,
  },

  // === 验证错误 ===
  'VAL_NO_GROUND': {
    category: 'validation',
    severity: 'error',
    message: '电路缺少接地点',
    detail: '每个电路必须至少有一个接地元件作为参考电位',
    suggestion: '请从元件库中添加一个接地元件并连接到电路中',
    recoverable: true,
  },
  'VAL_FLOATING_NODE': {
    category: 'validation',
    severity: 'warning',
    message: '存在未连接的节点',
    detail: '部分元件端口未正确连线',
    suggestion: '请检查所有元件端口的连接状态',
    recoverable: true,
  },
  'VAL_SHORT_CIRCUIT': {
    category: 'validation',
    severity: 'error',
    message: '检测到短路',
    detail: '电源正负极之间缺少负载',
    suggestion: '请在电源路径中添加电阻等负载元件',
    recoverable: true,
  },
  'VAL_NO_COMPONENTS': {
    category: 'validation',
    severity: 'warning',
    message: '电路为空',
    detail: '画面上没有任何元件',
    suggestion: '请从左侧元件面板拖入元件开始搭建电路',
    recoverable: true,
  },
  'VAL_HIGH_CURRENT': {
    category: 'validation',
    severity: 'warning',
    message: '电流值可能过大',
    detail: '电阻值过小可能导致异常大电流',
    suggestion: '建议增大电阻值或降低电源电压',
    recoverable: true,
  },

  // === 用户操作错误 ===
  'UA_INVALID_PARAM': {
    category: 'user_action',
    severity: 'warning',
    message: '参数值无效',
    detail: '输入的参数不在允许范围内',
    suggestion: '请检查输入值并更正',
    recoverable: true,
  },
  'UA_OPERATION_FAILED': {
    category: 'user_action',
    severity: 'error',
    message: '操作失败',
    detail: '无法完成请求的操作',
    suggestion: '请重试，或检查操作条件是否满足',
    recoverable: true,
  },
  'UA_FILE_ERROR': {
    category: 'user_action',
    severity: 'error',
    message: '文件操作失败',
    detail: '无法读取或写入文件',
    suggestion: '请检查文件格式是否正确，或文件是否被其他程序占用',
    recoverable: true,
  },

  // === 电路错误 ===
  'CKT_SAVE_FAILED': {
    category: 'circuit',
    severity: 'error',
    message: '电路保存失败',
    detail: '无法将电路数据保存到本地存储',
    suggestion: '请检查浏览器存储空间是否充足',
    recoverable: true,
  },
  'CKT_LOAD_FAILED': {
    category: 'circuit',
    severity: 'error',
    message: '电路加载失败',
    detail: '无法读取保存的电路数据',
    suggestion: '电路数据可能已损坏，请尝试导入备份文件',
    recoverable: true,
  },
  'CKT_TOO_LARGE': {
    category: 'circuit',
    severity: 'warning',
    message: '电路规模过大',
    detail: '当前电路包含大量元件，可能影响性能',
    suggestion: '建议将电路拆分为多个子模块',
    recoverable: true,
  },

  // === 系统错误 ===
  'SYS_UNKNOWN': {
    category: 'system',
    severity: 'error',
    message: '发生未知错误',
    detail: '程序遇到未预期的问题',
    suggestion: '请刷新页面重试。如问题持续，请联系技术支持',
    recoverable: false,
  },
  'SYS_MEMORY': {
    category: 'system',
    severity: 'critical',
    message: '内存不足',
    detail: '浏览器内存使用已达到上限',
    suggestion: '请关闭其他标签页或刷新页面释放内存',
    recoverable: true,
  },
};

// ==================== 工具函数 ====================

let errorCounter = 0;

/** 创建结构化错误 */
export function createAppError(
  code: string,
  originalError?: unknown,
  overrides?: Partial<ErrorDef>
): AppError {
  const def = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS['SYS_UNKNOWN'];
  const merged = { ...def, ...overrides };

  return {
    id: `app-err-${Date.now()}-${++errorCounter}`,
    category: merged.category,
    severity: merged.severity,
    code,
    message: merged.message,
    detail: merged.detail,
    suggestion: merged.suggestion,
    recoverable: merged.recoverable,
    timestamp: Date.now(),
    originalError,
  };
}

/** 从 ApiError 推断错误码 */
export function inferErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'kind' in error) {
    const apiError = error as { kind: string; statusCode?: number };
    switch (apiError.kind) {
      case 'network': return 'NET_OFFLINE';
      case 'timeout': return 'NET_TIMEOUT';
      case 'auth': return apiError.statusCode === 401 ? 'NET_AUTH_EXPIRED' : 'NET_FORBIDDEN';
      case 'server': return 'NET_SERVER_ERROR';
      case 'client':
        if (apiError.statusCode === 404) return 'NET_NOT_FOUND';
        return 'UA_OPERATION_FAILED';
    }
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('网络')) return 'NET_OFFLINE';
    if (msg.includes('timeout') || msg.includes('超时')) return 'NET_TIMEOUT';
    if (msg.includes('convergence') || msg.includes('收敛')) return 'SIM_CONVERGENCE_FAIL';
    if (msg.includes('singular') || msg.includes('矩阵')) return 'SIM_SINGULAR_MATRIX';
  }

  return 'SYS_UNKNOWN';
}

/** 格式化错误为用户可见的完整消息 */
export function formatErrorForUser(error: AppError): string {
  let msg = error.message;
  if (error.detail) {
    msg += `\n${error.detail}`;
  }
  if (error.suggestion) {
    msg += `\n💡 ${error.suggestion}`;
  }
  return msg;
}

/** 获取错误类型图标 */
export function getErrorCategoryIcon(category: ErrorCategory): string {
  switch (category) {
    case 'network': return '🌐';
    case 'simulation': return '⚡';
    case 'validation': return '🔍';
    case 'user_action': return '👆';
    case 'websocket': return '🔌';
    case 'circuit': return '📐';
    case 'system': return '⚙️';
    default: return '❓';
  }
}
