import { useState } from "react";
import type { LngLat, LngLatBounds } from "@/types/dataset";
import {
  DEFAULT_MAP_SOURCE,
  getInitialMapStyle,
  getMapSourceOptions,
  getMapSourceRequirement,
  getMapRenderer,
  getMapStyleOptions,
  resolveMapStyleUrl,
  type EditorMapSource,
  type EditorMapRenderer,
  type EditorMapStyle,
} from "./map-config";

export type EditorMapViewport = {
  center: LngLat;
  zoomLevel: number;
};

export type EditorMapState = {
  mapSource: EditorMapSource;
  mapSourceOptions: Array<{ value: EditorMapSource; label: string; isAvailable: boolean }>;
  mapStyle: EditorMapStyle;
  mapStyleOptions: Array<{ value: string; label: string }>;
  mapStyleUrl: string;
  mapRenderer: EditorMapRenderer;
  pendingFitBounds: LngLatBounds | null;
  selectedMapSourceRequirement: string | null;
  viewport: EditorMapViewport;
};

export type EditorMapActions = {
  setMapSource: (nextSource: EditorMapSource) => void;
  setMapStyle: (nextStyle: EditorMapStyle) => void;
  setPendingFitBounds: (bounds: LngLatBounds | null) => void;
  setViewport: (viewport: EditorMapViewport) => void;
};

type UseEditorMapStateOptions = {
  initialViewport: EditorMapViewport;
};

export function useEditorMapState({
  initialViewport,
}: UseEditorMapStateOptions): { mapState: EditorMapState; mapActions: EditorMapActions } {
  const [viewport, setViewport] = useState<EditorMapViewport>(initialViewport);
  const [pendingFitBounds, setPendingFitBounds] = useState<LngLatBounds | null>(null);
  const [mapSource, setMapSourceState] = useState<EditorMapSource>(DEFAULT_MAP_SOURCE);
  const [mapStyle, setMapStyleState] = useState<EditorMapStyle>(getInitialMapStyle(DEFAULT_MAP_SOURCE));

  function setMapSource(nextSource: EditorMapSource) {
    setMapSourceState(nextSource);
    setMapStyleState(getInitialMapStyle(nextSource));
  }

  const mapState: EditorMapState = {
    mapSource,
    mapSourceOptions: getMapSourceOptions(),
    mapStyle,
    mapStyleOptions: getMapStyleOptions(mapSource),
    mapStyleUrl: resolveMapStyleUrl(mapSource, mapStyle),
    mapRenderer: getMapRenderer(mapSource),
    pendingFitBounds,
    selectedMapSourceRequirement: getMapSourceRequirement(mapSource),
    viewport,
  };

  const mapActions: EditorMapActions = {
    setMapSource,
    setMapStyle: setMapStyleState,
    setPendingFitBounds,
    setViewport,
  };

  return { mapState, mapActions };
}
