/**
 * 交互式教程定义
 * 包含4个预置教程，涵盖从入门到进阶
 */

import type { Tutorial, TutorialStep } from '../../types/tutorial';
import { TutorialDifficulty, TutorialCategory, TutorialActionType, ValidationType } from '../../types/tutorial';

// ==================== 辅助函数 ====================

function makeStep(overrides: Partial<TutorialStep> & { id: string; title: string; instruction: string; action: TutorialActionType }): TutorialStep {
  return {
    highlightSelector: '',
    position: 'center',
    ...overrides,
  };
}

// ==================== 教程定义 ====================

export const TUTORIALS: Tutorial[] = [
  // ===== 教程1：认识界面 =====
  {
    id: 'intro-interface',
    title: '认识界面',
    description: '了解 ChipSim 编辑器的基本布局和操作方式',
    icon: '🖥️',
    difficulty: TutorialDifficulty.Beginner,
    estimatedTime: 3,
    category: TutorialCategory.GettingStarted,
    tags: ['入门', '界面', '布局'],
    steps: [
      makeStep({
        id: 'intro-welcome',
        title: '欢迎来到 ChipSim',
        instruction: `
          <p>ChipSim 是一个在线电路仿真平台，支持模拟电路、数字电路和嵌入式系统仿真。</p>
          <p>本教程将带您了解编辑器的基本布局，只需 <strong>3 分钟</strong>。</p>
        `,
        action: TutorialActionType.Read,
        position: 'center',
      }),
      makeStep({
        id: 'intro-component-library',
        title: '元件面板',
        instruction: `
          <p>左侧是<strong>元件面板</strong>，包含电阻、电容、三极管、运放等所有可用元件。</p>
          <p>您可以通过搜索框快速找到需要的元件，也可以按分类浏览。</p>
        `,
        highlightSelector: '.component-library, .editor-left',
        action: TutorialActionType.Read,
        position: 'right',
      }),
      makeStep({
        id: 'intro-canvas',
        title: '画布区域',
        instruction: `
          <p>中间是<strong>电路画布</strong>，您在这里搭建电路。</p>
          <ul>
            <li>🖱️ <strong>拖拽</strong>元件到画布上放置</li>
            <li>🔗 点击元件的<strong>端口</strong>开始连线</li>
            <li>🔍 <strong>滚轮</strong>缩放，<strong>中键拖动</strong>平移</li>
          </ul>
        `,
        highlightSelector: '.editor-canvas-area, canvas',
        action: TutorialActionType.Read,
        position: 'left',
      }),
      makeStep({
        id: 'intro-property-panel',
        title: '属性面板',
        instruction: `
          <p>右侧是<strong>属性面板</strong>。选中元件后，可以在这里修改：</p>
          <ul>
            <li>元件参数值（如电阻阻值、电容容量）</li>
            <li>元件名称</li>
            <li>旋转角度</li>
          </ul>
        `,
        highlightSelector: '.property-panel, .editor-right',
        action: TutorialActionType.Read,
        position: 'left',
      }),
      makeStep({
        id: 'intro-bottom-tabs',
        title: '底部面板',
        instruction: `
          <p>底部有多个标签页：</p>
          <ul>
            <li>📊 <strong>波形</strong>：查看仿真波形</li>
            <li>📐 <strong>测量</strong>：电压/电流/功率测量</li>
            <li>🔧 <strong>属性</strong>：快速编辑</li>
            <li>✅ <strong>验证</strong>：电路检查结果</li>
          </ul>
          <p>点击底部标签可以切换面板。</p>
        `,
        highlightSelector: '.tab-bar, .bottom-tabs',
        action: TutorialActionType.Read,
        position: 'top',
      }),
    ],
  },

  // ===== 教程2：搭建第一个电路 =====
  {
    id: 'first-circuit',
    title: '搭建第一个电路',
    description: '动手搭建一个 LED 闪烁电路，学习基本操作',
    icon: '💡',
    difficulty: TutorialDifficulty.Beginner,
    estimatedTime: 5,
    category: TutorialCategory.GettingStarted,
    tags: ['LED', '电阻', '动手'],
    prerequisiteIds: ['intro-interface'],
    steps: [
      makeStep({
        id: 'circuit-intro',
        title: 'LED 电路简介',
        instruction: `
          <p>我们将搭建一个简单的 LED 驱动电路：</p>
          <p><strong>电源(5V) → 限流电阻(330Ω) → LED → 接地</strong></p>
          <p>这个电路是学习电子学的第一个项目！</p>
        `,
        action: TutorialActionType.Read,
        position: 'center',
      }),
      makeStep({
        id: 'circuit-load-template',
        title: '加载示例电路',
        instruction: `
          <p>为了节省时间，我们直接加载一个预置的 LED 电路。</p>
          <p>请在左侧<strong>帮助面板</strong>中，点击 <strong>示例</strong> 标签页，找到 "LED 闪烁电路" 并点击 <strong>加载</strong> 按钮。</p>
        `,
        highlightSelector: '.help-tab, .example-load-btn',
        action: TutorialActionType.Click,
        position: 'right',
        hint: '在左侧帮助面板中切换到"示例"标签，找到 LED 闪烁电路。',
        validation: {
          type: ValidationType.ComponentExists,
          componentName: 'R1',
        },
      }),
      makeStep({
        id: 'circuit-examine',
        title: '认识电路元件',
        instruction: `
          <p>电路已加载到画布上！让我们认识每个元件：</p>
          <ul>
            <li>⚡ <strong>V1</strong>：5V 直流电源</li>
            <li>🔧 <strong>R1</strong>：330Ω 限流电阻（保护 LED）</li>
            <li>💡 <strong>D1</strong>：LED（发光二极管）</li>
            <li>⏚ <strong>GND</strong>：接地符号</li>
          </ul>
          <p>点击选中电阻 R1 看看它的属性。</p>
        `,
        action: TutorialActionType.SelectComponent,
        highlightSelector: '[data-component-name="R1"], .circuit-component',
        hint: '在画布上找到标有 "R1" 的元件，点击选中它。',
      }),
      makeStep({
        id: 'circuit-run-sim',
        title: '运行仿真',
        instruction: `
          <p>现在点击工具栏上的 <strong>"运行仿真"</strong> 按钮，查看电路的工作状态。</p>
          <p>仿真完成后，您可以看到 LED 两端的电压和回路中的电流。</p>
        `,
        highlightSelector: '.simulator-control, .tb-btn-test, [data-testid="run-simulation"]',
        action: TutorialActionType.RunSimulation,
        position: 'bottom',
        hint: '在工具栏或底部面板找到"运行仿真"按钮。',
      }),
      makeStep({
        id: 'circuit-view-waveform',
        title: '查看波形结果',
        instruction: `
          <p>切换到底部 <strong>波形</strong> 面板，查看仿真结果。</p>
          <p>您应该能看到 LED 两端电压约 <strong>0.7V</strong>（正向导通压降），回路电流约 <strong>13mA</strong>。</p>
          <p>🎉 <strong>恭喜！</strong>您已经成功搭建并仿真了第一个电路！</p>
        `,
        highlightSelector: '.waveform-panel, [data-tab="waveform"]',
        action: TutorialActionType.ViewWaveform,
        position: 'top',
        hint: '点击底部的"波形"标签页查看仿真结果。',
      }),
    ],
  },

  // ===== 教程3：使用示波器 =====
  {
    id: 'oscilloscope-usage',
    title: '使用示波器',
    description: '学习波形查看、光标测量和频率分析',
    icon: '📊',
    difficulty: TutorialDifficulty.Intermediate,
    estimatedTime: 5,
    category: TutorialCategory.Measurement,
    tags: ['波形', '测量', '示波器', '频率'],
    prerequisiteIds: ['first-circuit'],
    steps: [
      makeStep({
        id: 'scope-intro',
        title: '示波器功能简介',
        instruction: `
          <p>ChipSim 的波形面板就像一台虚拟示波器，您可以：</p>
          <ul>
            <li>📊 同时显示多个信号波形</li>
            <li>📏 使用光标精确测量时间差和电压差</li>
            <li>📈 查看 FFT 频谱分析</li>
            <li>🔍 缩放和平移波形</li>
          </ul>
        `,
        action: TutorialActionType.Read,
        position: 'center',
      }),
      makeStep({
        id: 'scope-load-rc',
        title: '加载 RC 滤波器',
        instruction: `
          <p>我们加载一个 <strong>RC 低通滤波器</strong> 示例，它非常适合展示频率响应特性。</p>
          <p>在帮助面板的 <strong>示例</strong> 标签中，找到 "RC 滤波器" 并加载它。</p>
        `,
        highlightSelector: '.example-load-btn, .help-tab',
        action: TutorialActionType.Click,
        hint: '切换到示例标签，搜索"RC"找到 RC 滤波器。',
      }),
      makeStep({
        id: 'scope-run-ac',
        title: '运行 AC 扫描',
        instruction: `
          <p>RC 滤波器需要运行 <strong>AC 扫描分析</strong> 才能看到频率响应。</p>
          <p>在底部 <strong>仿真控制</strong> 面板中，选择分析类型为 "AC"，设置频率范围 1Hz ~ 1MHz，然后点击运行。</p>
        `,
        highlightSelector: '.simulator-control, [data-tab="simulator"]',
        action: TutorialActionType.RunSimulation,
        position: 'bottom',
        hint: '在仿真控制面板选择 AC 分析模式后运行。',
      }),
      makeStep({
        id: 'scope-view-waveform',
        title: '观察频率响应',
        instruction: `
          <p>切换到 <strong>波形</strong> 面板。您应该看到 RC 滤波器的幅频特性曲线：</p>
          <ul>
            <li>低频段：信号几乎无衰减通过</li>
            <li>截止频率 f<sub>c</sub> = 1/(2πRC) ≈ <strong>159Hz</strong>：-3dB 点</li>
            <li>高频段：信号以 -20dB/dec 的速率衰减</li>
          </ul>
        `,
        highlightSelector: '.waveform-panel',
        action: TutorialActionType.ViewWaveform,
        position: 'top',
      }),
      makeStep({
        id: 'scope-measurement',
        title: '使用测量工具',
        instruction: `
          <p>切换到 <strong>测量</strong> 面板，您可以添加探针测量：</p>
          <ul>
            <li>📏 <strong>光标测量</strong>：拖动光标线精确读取电压和时间</li>
            <li>📐 <strong>自动测量</strong>：Vpp、RMS、频率自动计算</li>
          </ul>
          <p>🎉 恭告！您已经掌握了波形分析的基本技能！</p>
        `,
        highlightSelector: '.measurement-panel, [data-tab="measurement"]',
        action: TutorialActionType.Read,
        position: 'top',
      }),
    ],
  },

  // ===== 教程4：数字电路入门 =====
  {
    id: 'digital-basics',
    title: '数字电路入门',
    description: '学习逻辑门、真值表和基本数字电路设计',
    icon: '🔀',
    difficulty: TutorialDifficulty.Intermediate,
    estimatedTime: 6,
    category: TutorialCategory.Digital,
    tags: ['逻辑门', 'AND', '真值表', '数字'],
    prerequisiteIds: ['first-circuit'],
    steps: [
      makeStep({
        id: 'digital-intro',
        title: '数字电路基础',
        instruction: `
          <p>数字电路使用 <strong>高电平(1)</strong> 和 <strong>低电平(0)</strong> 两种状态来表示信息。</p>
          <p>最基本的数字元件是 <strong>逻辑门</strong>，包括：AND（与）、OR（或）、NOT（非）、NAND、NOR、XOR 等。</p>
        `,
        action: TutorialActionType.Read,
        position: 'center',
      }),
      makeStep({
        id: 'digital-load-and',
        title: '加载与门电路',
        instruction: `
          <p>加载一个 AND（与门）电路示例。</p>
          <p>在帮助面板 → 示例中，找到 "与门逻辑" 并点击加载。</p>
        `,
        highlightSelector: '.example-load-btn, .help-tab',
        action: TutorialActionType.Click,
        hint: '搜索"与门"或"AND"快速定位。',
      }),
      makeStep({
        id: 'digital-truth-table',
        title: '验证真值表',
        instruction: `
          <p>AND 门的真值表是：</p>
          <table style="margin:8px 0;border-collapse:collapse;width:100%">
            <tr style="border-bottom:1px solid #333"><td>A</td><td>B</td><td>输出</td></tr>
            <tr><td>0</td><td>0</td><td><strong>0</strong></td></tr>
            <tr><td>0</td><td>1</td><td><strong>0</strong></td></tr>
            <tr><td>1</td><td>0</td><td><strong>0</strong></td></tr>
            <tr><td>1</td><td>1</td><td><strong>1</strong></td></tr>
          </table>
          <p>修改 VA 和 VB 的电压值（0V 或 5V），运行仿真验证四种组合！</p>
        `,
        action: TutorialActionType.RunSimulation,
        highlightSelector: '.simulator-control, .tb-btn-test',
        hint: '先修改输入电压，再运行仿真。',
      }),
      makeStep({
        id: 'digital-latch',
        title: 'SR 锁存器',
        instruction: `
          <p>将两个 NAND 门交叉耦合，就构成了 <strong>SR 锁存器</strong> —— 最简单的存储元件。</p>
          <p>您可以从元件面板中拖出两个 NAND 门，手动搭建交叉反馈电路，或者加载 "与非门SR锁存器" 示例。</p>
          <p>SR 锁存器可以"记住"一个比特的信息！</p>
        `,
        action: TutorialActionType.Read,
        position: 'center',
      }),
      makeStep({
        id: 'digital-complete',
        title: '数字电路小结',
        instruction: `
          <p>🎯 在本教程中，您学习了：</p>
          <ul>
            <li>逻辑门的基本功能和真值表</li>
            <li>如何通过修改输入观察输出</li>
            <li>SR 锁存器 —— 组合逻辑到时序逻辑的桥梁</li>
          </ul>
          <p>💡 下一步：尝试自己搭建一个 <strong>异或门(XOR)</strong> 电路，用 AND/OR/NOT 组合实现！</p>
        `,
        action: TutorialActionType.Read,
        position: 'center',
      }),
    ],
  },
];

// ==================== 教程分类 ====================

export const TUTORIAL_CATEGORIES: {
  key: TutorialCategory;
  label: string;
  icon: string;
}[] = [
  { key: TutorialCategory.GettingStarted, label: '入门', icon: '🚀' },
  { key: TutorialCategory.Analog, label: '模拟电路', icon: '🔊' },
  { key: TutorialCategory.Digital, label: '数字电路', icon: '🔀' },
  { key: TutorialCategory.Embedded, label: '嵌入式', icon: '🖥️' },
  { key: TutorialCategory.Measurement, label: '测量', icon: '📊' },
];

// ==================== 查询函数 ====================

/** 按分类获取教程 */
export function getTutorialsByCategory(category: TutorialCategory): Tutorial[] {
  return TUTORIALS.filter((t) => t.category === category);
}

/** 按难度获取教程 */
export function getTutorialsByDifficulty(difficulty: TutorialDifficulty): Tutorial[] {
  return TUTORIALS.filter((t) => t.difficulty === difficulty);
}

/** 搜索教程 */
export function searchTutorials(query: string): Tutorial[] {
  const q = query.toLowerCase().trim();
  if (!q) return TUTORIALS;
  return TUTORIALS.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.tags?.some((tag) => tag.includes(q)) ||
      t.id.includes(q)
  );
}

/** 获取推荐教程（入门优先） */
export function getRecommendedTutorials(completedIds: string[]): Tutorial[] {
  return TUTORIALS.filter((t) => {
    // 已完成的不推荐
    if (completedIds.includes(t.id)) return false;
    // 前置条件必须满足
    if (t.prerequisiteIds?.length) {
      return t.prerequisiteIds.every((id) => completedIds.includes(id));
    }
    return true;
  }).sort((a, b) => {
    const diffOrder = { beginner: 0, intermediate: 1, advanced: 2 };
    return diffOrder[a.difficulty] - diffOrder[b.difficulty];
  });
}
