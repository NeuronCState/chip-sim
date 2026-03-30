/**
 * CircuitDiff - 电路变更比较算法
 * 计算两个电路版本之间的差异，支持元件增删改、连线变化
 */

import type {
  CircuitComponent,
  CircuitNode,
  Wire,
} from '../types/circuit';
import type {
  ComponentChange,
  WireChange,
  ParamChange,
  ChangeSummary,
  DiffResult,
} from '../types/version';
import { ChangeType } from '../types/version';

// ==================== 元件比较 ====================

/** 比较两个元件值是否相等 */
function valuesEqual(
  a: { value: number; unit: string; prefix?: string },
  b: { value: number; unit: string; prefix?: string }
): boolean {
  return a.value === b.value && a.unit === b.unit && a.prefix === b.prefix;
}

/** 比较两个位置是否接近（容差 5px） */
function positionsEqual(
  a: { x: number; y: number },
  b: { x: number; y: number },
  tolerance = 5
): boolean {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

/** 计算单个元件的参数变化 */
function computeParamChanges(
  before: CircuitComponent,
  after: CircuitComponent
): ParamChange[] {
  const changes: ParamChange[] = [];

  // 名称变化
  if (before.name !== after.name) {
    changes.push({
      field: 'name',
      label: '名称',
      oldValue: before.name,
      newValue: after.name,
    });
  }

  // 类型变化
  if (before.type !== after.type) {
    changes.push({
      field: 'type',
      label: '类型',
      oldValue: before.type,
      newValue: after.type,
    });
  }

  // 旋转角度变化
  if (before.rotation !== after.rotation) {
    changes.push({
      field: 'rotation',
      label: '旋转',
      oldValue: `${before.rotation}°`,
      newValue: `${after.rotation}°`,
    });
  }

  // 元件值变化
  if (!valuesEqual(before.value, after.value)) {
    const fmtBefore = `${before.value.prefix ?? ''}${before.value.value} ${before.value.unit}`;
    const fmtAfter = `${after.value.prefix ?? ''}${after.value.value} ${after.value.unit}`;
    changes.push({
      field: 'value',
      label: '参数值',
      oldValue: fmtBefore,
      newValue: fmtAfter,
    });
  }

  // 额外参数变化
  const allKeys = new Set([
    ...Object.keys(before.params ?? {}),
    ...Object.keys(after.params ?? {}),
  ]);
  for (const key of allKeys) {
    const oldVal = before.params?.[key];
    const newVal = after.params?.[key];
    if (oldVal !== newVal) {
      changes.push({
        field: `params.${key}`,
        label: key,
        oldValue: oldVal ?? '(无)',
        newValue: newVal ?? '(无)',
      });
    }
  }

  return changes;
}

/** 判断两个元件是否"本质上相同"（仅位置不同） */
function isSameComponentMoved(a: CircuitComponent, b: CircuitComponent): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.name === b.name &&
    a.rotation === b.rotation &&
    valuesEqual(a.value, b.value) &&
    !positionsEqual(a.position, b.position)
  );
}

/** 判断两个元件是否是同一元件且有参数修改 */
function isSameComponentModified(a: CircuitComponent, b: CircuitComponent): boolean {
  if (a.id !== b.id) return false;
  const changes = computeParamChanges(a, b);
  // 位置变化不算"修改"，算"移动"
  const nonMoveChanges = changes.filter(c => c.field !== 'position');
  return nonMoveChanges.length > 0;
}

// ==================== 核心 Diff 算法 ====================

/**
 * 比较两个电路数据，返回差异
 */
export function computeDiff(
  before: { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] },
  after: { components: CircuitComponent[]; nodes: CircuitNode[]; wires: Wire[] }
): DiffResult {
  const componentChanges = diffComponents(before.components, after.components);
  const wireChanges = diffWires(before.wires, after.wires);

  const summary = buildSummary(componentChanges, wireChanges);

  return {
    fromVersionId: '',
    toVersionId: '',
    componentChanges,
    wireChanges,
    summary,
  };
}

/**
 * 比较元件列表
 */
export function diffComponents(
  before: CircuitComponent[],
  after: CircuitComponent[]
): ComponentChange[] {
  const changes: ComponentChange[] = [];
  const beforeMap = new Map(before.map(c => [c.id, c]));
  const afterMap = new Map(after.map(c => [c.id, c]));

  // 检查删除和修改
  for (const [id, oldComp] of beforeMap) {
    const newComp = afterMap.get(id);
    if (!newComp) {
      // 元件被删除
      changes.push({
        type: ChangeType.Removed,
        componentId: id,
        before: oldComp,
      });
    } else if (isSameComponentMoved(oldComp, newComp)) {
      // 元件被移动
      changes.push({
        type: ChangeType.Moved,
        componentId: id,
        before: oldComp,
        after: newComp,
      });
    } else if (isSameComponentModified(oldComp, newComp)) {
      // 元件参数被修改
      changes.push({
        type: ChangeType.Modified,
        componentId: id,
        before: oldComp,
        after: newComp,
        paramChanges: computeParamChanges(oldComp, newComp),
      });
    }
    // 如果完全相同，不记录变更
  }

  // 检查新增
  for (const [id, newComp] of afterMap) {
    if (!beforeMap.has(id)) {
      changes.push({
        type: ChangeType.Added,
        componentId: id,
        after: newComp,
      });
    }
  }

  return changes;
}

/**
 * 比较连线列表
 */
export function diffWires(before: Wire[], after: Wire[]): WireChange[] {
  const changes: WireChange[] = [];
  const beforeMap = new Map(before.map(w => [w.id, w]));
  const afterMap = new Map(after.map(w => [w.id, w]));

  for (const [id, oldWire] of beforeMap) {
    if (!afterMap.has(id)) {
      changes.push({
        type: ChangeType.Removed,
        wireId: id,
        before: oldWire,
      });
    }
  }

  for (const [id, newWire] of afterMap) {
    if (!beforeMap.has(id)) {
      changes.push({
        type: ChangeType.Added,
        wireId: id,
        after: newWire,
      });
    }
  }

  return changes;
}

/**
 * 构建变更摘要
 */
export function buildSummary(
  componentChanges: ComponentChange[],
  wireChanges: WireChange[]
): ChangeSummary {
  let componentsAdded = 0;
  let componentsRemoved = 0;
  let componentsModified = 0;
  let componentsMoved = 0;

  for (const change of componentChanges) {
    switch (change.type) {
      case ChangeType.Added: componentsAdded++; break;
      case ChangeType.Removed: componentsRemoved++; break;
      case ChangeType.Modified: componentsModified++; break;
      case ChangeType.Moved: componentsMoved++; break;
    }
  }

  let wiresAdded = 0;
  let wiresRemoved = 0;

  for (const change of wireChanges) {
    switch (change.type) {
      case ChangeType.Added: wiresAdded++; break;
      case ChangeType.Removed: wiresRemoved++; break;
    }
  }

  return {
    componentsAdded,
    componentsRemoved,
    componentsModified,
    componentsMoved,
    wiresAdded,
    wiresRemoved,
    wiresModified: 0,
    componentChanges,
    wireChanges,
  };
}

// ==================== 变更文本描述 ====================

/**
 * 生成变更摘要的文本描述
 */
export function describeChangeSummary(summary: ChangeSummary): string {
  const parts: string[] = [];

  if (summary.componentsAdded > 0) {
    parts.push(`+${summary.componentsAdded} 元件`);
  }
  if (summary.componentsRemoved > 0) {
    parts.push(`-${summary.componentsRemoved} 元件`);
  }
  if (summary.componentsModified > 0) {
    parts.push(`~${summary.componentsModified} 元件修改`);
  }
  if (summary.componentsMoved > 0) {
    parts.push(`↗${summary.componentsMoved} 元件移动`);
  }
  if (summary.wiresAdded > 0) {
    parts.push(`+${summary.wiresAdded} 连线`);
  }
  if (summary.wiresRemoved > 0) {
    parts.push(`-${summary.wiresRemoved} 连线`);
  }

  if (parts.length === 0) return '无变更';
  return parts.join(', ');
}

/**
 * 生成单条变更的详细描述
 */
export function describeChange(change: ComponentChange | WireChange): string {
  if ('componentId' in change) {
    const name = change.before?.name || change.after?.name || change.componentId;
    switch (change.type) {
      case ChangeType.Added:
        return `添加了元件 ${name} (${change.after?.type})`;
      case ChangeType.Removed:
        return `删除了元件 ${name} (${change.before?.type})`;
      case ChangeType.Modified: {
        const paramDesc = change.paramChanges
          ?.map(p => `${p.label}: ${p.oldValue} → ${p.newValue}`)
          .join(', ') ?? '';
        return `修改了元件 ${name}: ${paramDesc}`;
      }
      case ChangeType.Moved:
        return `移动了元件 ${name}`;
    }
  } else {
    const label = `连线 ${change.wireId.slice(0, 8)}`;
    switch (change.type) {
      case ChangeType.Added:
        return `添加了${label}`;
      case ChangeType.Removed:
        return `删除了${label}`;
      default:
        return `${label} 变更`;
    }
  }
  return '';
}

export default computeDiff;
