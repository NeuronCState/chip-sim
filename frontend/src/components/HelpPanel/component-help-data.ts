/**
 * 元件帮助数据
 * 每个元件类型的详细文档：用途说明、典型接法、常见错误
 */

import { ComponentType } from '../../types/circuit';
import type { ComponentType as CT } from '../../types/circuit';

export interface ComponentHelpData {
  type: CT;
  /** 名称 i18n key */
  nameKey: string;
  /** 描述 i18n key */
  descKey: string;
  /** 典型用法 i18n key */
  usageKey: string;
  /** 接线提示 i18n key */
  wiringKey: string;
  /** 常见错误 i18n key */
  mistakeKey: string;
  /** 图标 */
  icon: string;
  /** 关键参数 */
  keyParams: string[];
}

export const COMPONENT_HELP: ComponentHelpData[] = [
  {
    type: ComponentType.Resistor,
    nameKey: 'comp.resistor.name',
    descKey: 'comp.resistor.desc',
    usageKey: 'comp.resistor.usage',
    wiringKey: 'comp.resistor.wiring',
    mistakeKey: 'comp.resistor.mistake',
    icon: '⚡',
    keyParams: ['阻值 (Ω)'],
  },
  {
    type: ComponentType.Capacitor,
    nameKey: 'comp.capacitor.name',
    descKey: 'comp.capacitor.desc',
    usageKey: 'comp.capacitor.usage',
    wiringKey: 'comp.capacitor.wiring',
    mistakeKey: 'comp.capacitor.mistake',
    icon: '⊥',
    keyParams: ['电容值 (F)'],
  },
  {
    type: ComponentType.Inductor,
    nameKey: 'comp.inductor.name',
    descKey: 'comp.inductor.desc',
    usageKey: 'comp.inductor.usage',
    wiringKey: 'comp.inductor.wiring',
    mistakeKey: 'comp.inductor.mistake',
    icon: '∿',
    keyParams: ['电感值 (H)'],
  },
  {
    type: ComponentType.DCSource,
    nameKey: 'comp.dc_source.name',
    descKey: 'comp.dc_source.desc',
    usageKey: 'comp.dc_source.usage',
    wiringKey: 'comp.dc_source.wiring',
    mistakeKey: 'comp.dc_source.mistake',
    icon: '⊕',
    keyParams: ['电压 (V)'],
  },
  {
    type: ComponentType.ACSource,
    nameKey: 'comp.ac_source.name',
    descKey: 'comp.ac_source.desc',
    usageKey: 'comp.ac_source.usage',
    wiringKey: 'comp.ac_source.wiring',
    mistakeKey: 'comp.ac_source.mistake',
    icon: '〰',
    keyParams: ['幅值 (V)', '频率 (Hz)', '相位 (°)'],
  },
  {
    type: ComponentType.Ground,
    nameKey: 'comp.ground.name',
    descKey: 'comp.ground.desc',
    usageKey: 'comp.ground.usage',
    wiringKey: 'comp.ground.wiring',
    mistakeKey: 'comp.ground.mistake',
    icon: '⏚',
    keyParams: [],
  },
  {
    type: ComponentType.Diode,
    nameKey: 'comp.diode.name',
    descKey: 'comp.diode.desc',
    usageKey: 'comp.diode.usage',
    wiringKey: 'comp.diode.wiring',
    mistakeKey: 'comp.diode.mistake',
    icon: '▷|',
    keyParams: ['正向压降 (V)'],
  },
  {
    type: ComponentType.BJTNPN,
    nameKey: 'comp.bjt_npn.name',
    descKey: 'comp.bjt_npn.desc',
    usageKey: 'comp.bjt_npn.usage',
    wiringKey: 'comp.bjt_npn.wiring',
    mistakeKey: 'comp.bjt_npn.mistake',
    icon: '⊳',
    keyParams: ['β (电流增益)'],
  },
  {
    type: ComponentType.OpAmp,
    nameKey: 'comp.op_amp.name',
    descKey: 'comp.op_amp.desc',
    usageKey: 'comp.op_amp.usage',
    wiringKey: 'comp.op_amp.wiring',
    mistakeKey: 'comp.op_amp.mistake',
    icon: '⊳',
    keyParams: ['开环增益 (A/V)'],
  },
  {
    type: ComponentType.LogicAND,
    nameKey: 'comp.logic_and.name',
    descKey: 'comp.logic_and.desc',
    usageKey: 'comp.logic_and.usage',
    wiringKey: 'comp.logic_and.wiring',
    mistakeKey: 'comp.logic_and.mistake',
    icon: '&',
    keyParams: [],
  },
  {
    type: ComponentType.LogicOR,
    nameKey: 'comp.logic_or.name',
    descKey: 'comp.logic_or.desc',
    usageKey: 'comp.logic_or.usage',
    wiringKey: 'comp.logic_or.wiring',
    mistakeKey: 'comp.logic_or.mistake',
    icon: '≥1',
    keyParams: [],
  },
  {
    type: ComponentType.LogicNOT,
    nameKey: 'comp.logic_not.name',
    descKey: 'comp.logic_not.desc',
    usageKey: 'comp.logic_not.usage',
    wiringKey: 'comp.logic_not.wiring',
    mistakeKey: 'comp.logic_not.mistake',
    icon: '1',
    keyParams: [],
  },
  {
    type: ComponentType.MCU,
    nameKey: 'comp.mcu.name',
    descKey: 'comp.mcu.desc',
    usageKey: 'comp.mcu.usage',
    wiringKey: 'comp.mcu.wiring',
    mistakeKey: 'comp.mcu.mistake',
    icon: '🔲',
    keyParams: ['VDD (V)', '引脚数'],
  },
  {
    type: ComponentType.ADC,
    nameKey: 'comp.adc.name',
    descKey: 'comp.adc.desc',
    usageKey: 'comp.adc.usage',
    wiringKey: 'comp.adc.wiring',
    mistakeKey: 'comp.adc.mistake',
    icon: 'A/D',
    keyParams: ['VRef (V)', 'Resolution (bit)', 'Sample Rate (Hz)'],
  },
  {
    type: ComponentType.DAC,
    nameKey: 'comp.dac.name',
    descKey: 'comp.dac.desc',
    usageKey: 'comp.dac.usage',
    wiringKey: 'comp.dac.wiring',
    mistakeKey: 'comp.dac.mistake',
    icon: 'D/A',
    keyParams: ['VRef (V)', 'Resolution (bit)'],
  },
];

/** 根据元件类型获取帮助数据 */
export function getHelpForComponent(type: CT): ComponentHelpData | undefined {
  return COMPONENT_HELP.find((h) => h.type === type);
}
