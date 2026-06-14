import type { OmchhSettingsShape } from "../shared/preferences-shape";

type CapabilityValue = OmchhSettingsShape[keyof OmchhSettingsShape];

export type CapabilityControl =
  | {
      type: "select";
      label: string;
      description: string;
      options: Array<{ value: string; label: string }>;
    }
  | {
      type: "checkbox";
      label: string;
      description: string;
    };

export interface CapabilityDescriptor {
  id: string;
  settingKey: keyof OmchhSettingsShape;
  rootAttr: `data-omchh-${string}`;
  toAttr(value: CapabilityValue): string;
  control: CapabilityControl;
  hasBehavior?: false;
}

export const CAPABILITY_CATALOG: CapabilityDescriptor[] = [
  {
    id: "density",
    settingKey: "density",
    rootAttr: "data-omchh-density",
    toAttr: (value) => (value === "comfortable" ? "comfortable" : "compact"),
    control: {
      type: "select",
      label: "阅读密度",
      description: "控制主题布局的紧凑或舒适间距。",
      options: [
        { value: "compact", label: "紧凑" },
        { value: "comfortable", label: "舒适" }
      ]
    }
  },
  {
    id: "reduce-glass",
    settingKey: "reduceGlass",
    rootAttr: "data-omchh-reduce-glass",
    toAttr: (value) => (value === true ? "1" : "0"),
    control: {
      type: "checkbox",
      label: "减弱玻璃效果",
      description: "向主题发出弱玻璃信号，减少高透材质。"
    }
  },
  {
    id: "reduced-motion",
    settingKey: "reduceMotion",
    rootAttr: "data-omchh-motion",
    toAttr: (value) => (value === true ? "reduce" : "default"),
    control: {
      type: "checkbox",
      label: "减少动效",
      description: "向主题发出减动效信号。"
    }
  },
  {
    id: "color-scheme",
    settingKey: "colorScheme",
    rootAttr: "data-omchh-scheme",
    toAttr: (value) => (value === "dark" ? "dark" : "light"),
    control: {
      type: "select",
      label: "色彩模式",
      description: "选择全局明暗意图，具体呈现由当前主题负责。",
      options: [
        { value: "light", label: "浅色" },
        { value: "dark", label: "深色" }
      ]
    }
  }
];

export const CAPABILITY_SETTING_KEYS = CAPABILITY_CATALOG.map((capability) => capability.settingKey);
