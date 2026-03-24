import { useState } from "react";
import type { LngLat } from "@/types/dataset";
import {
  DEFAULT_MAP_SOURCE,
  getInitialMapStyle,
  getMapSourceOptions,
  getMapSourceRequirement,
  getMapStyleOptions,
  resolveMapStyleUrl,
  type EditorMapSource,
  type EditorMapStyle,
} from "./map-config";

export type EditorMapViewport = {
  center: LngLat;
  zoomLevel: number;
};

export type EditorMapState = {
  isBearingEnabled: boolean;
  isPitchEnabled: boolean;
  mapSource: EditorMapSource;
  mapSourceOptions: Array<{ value: EditorMapSource; label: string; isAvailable: boolean }>;
  mapStyle: EditorMapStyle;
  mapStyleOptions: Array<{ value: string; label: string }>;
  mapStyleUrl: string;
  pendingFitBounds: [LngLat, LngLat] | null;
  selectedMapSourceRequirement: string | null;
  viewport: EditorMapViewport;
};

export type EditorMapActions = {
  setBearingEnabled: (nextValue: boolean) => void;
  setMapSource: (nextSource: EditorMapSource) => void;
  setMapStyle: (nextStyle: EditorMapStyle) => void;
  setPendingFitBounds: (bounds: [LngLat, LngLat] | null) => void;
  setPitchEnabled: (nextValue: boolean) => void;
  setViewport: (viewport: EditorMapViewport) => void;
};

type UseEditorMapStateOptions = {
  initialViewport: EditorMapViewport;
};

export function useEditorMapState({
  initialViewport,
}: UseEditorMapStateOptions): { mapState: EditorMapState; mapActions: EditorMapActions } {
  const [viewport, setViewport] = useState<EditorMapViewport>(initialViewport);
  const [pendingFitBounds, setPendingFitBounds] = useState<[LngLat, LngLat] | null>(null);
  const [isBearingEnabled, setBearingEnabled] = useState(false);
  const [isPitchEnabled, setPitchEnabled] = useState(false);
  const [mapSource, setMapSourceState] = useState<EditorMapSource>(DEFAULT_MAP_SOURCE);
  const [mapStyle, setMapStyleState] = useState<EditorMapStyle>(getInitialMapStyle(DEFAULT_MAP_SOURCE));

  function setMapSource(nextSource: EditorMapSource) {
    setMapSourceState(nextSource);
    setMapStyleState(getInitialMapStyle(nextSource));
  }

  const mapState: EditorMapState = {
    isBearingEnabled,
    isPitchEnabled,
    mapSource,
    mapSourceOptions: getMapSourceOptions(),
    mapStyle,
    mapStyleOptions: getMapStyleOptions(mapSource),
    mapStyleUrl: resolveMapStyleUrl(mapSource, mapStyle),
    pendingFitBounds,
    selectedMapSourceRequirement: getMapSourceRequirement(mapSource),
    viewport,
  };

  const mapActions: EditorMapActions = {
    setBearingEnabled,
    setMapSource,
    setMapStyle: setMapStyleState,
    setPendingFitBounds,
    setPitchEnabled,
    setViewport,
  };

  return { mapState, mapActions };
}
