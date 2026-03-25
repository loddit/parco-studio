import {
  IconLeaf,
  IconMap,
  IconMoon,
  IconMountain,
  IconSatellite,
  IconSun,
} from "@tabler/icons-react";
import type { EditorMapStyle } from "./map-config";

const MAP_STYLE_ICON_MAP = {
  default: IconMap,
  satellite: IconSatellite,
  terrain: IconMountain,
  dark: IconMoon,
  nature: IconLeaf,
  light: IconSun,
} as const;

type MapStyleSwitcherProps = {
  activeStyle: string;
  options: Array<{ value: string; label: string }>;
  onSelect: (style: EditorMapStyle) => void;
};

export function MapStyleSwitcher({ activeStyle, options, onSelect }: MapStyleSwitcherProps) {
  return (
    <div className="flex items-center rounded-xl bg-white">
      {options.map((option) => {
        const Icon = MAP_STYLE_ICON_MAP[option.value as keyof typeof MAP_STYLE_ICON_MAP] ?? IconMap;

        return (
          <button
            className={`${
              activeStyle === option.value ? "bg-slate-300" : "bg-white"
            } h-9 min-w-9 cursor-pointer rounded-none border-y-2 border-l-2 border-slate-500/20 px-1.5 text-slate-900 shadow-none first:rounded-l-xl last:rounded-r-xl last:border-r-2 hover:bg-slate-100`}
            key={option.value}
            onClick={() => onSelect(option.value as EditorMapStyle)}
            title={option.label}
            type="button"
          >
            <Icon size={20} stroke={2} />
          </button>
        );
      })}
    </div>
  );
}
