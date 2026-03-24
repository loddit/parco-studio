import {
  IconLeaf,
  IconMap,
  IconMoon,
  IconMountain,
  IconSatellite,
  IconSun,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef } from "react";
import MapboxMap, {
  Layer as MapboxLayer,
  Marker as MapboxMarker,
  NavigationControl as MapboxNavigationControl,
  Source as MapboxSource,
  type LayerProps as MapboxLayerProps,
  type MapMouseEvent as MapboxLayerMouseEvent,
  type MapRef as MapboxMapRef,
  type MarkerEvent as MapboxMarkerEvent,
} from "react-map-gl/mapbox";
import MapLibreMap, {
  Layer as MapLibreLayer,
  Marker as MapLibreMarker,
  NavigationControl as MapLibreNavigationControl,
  Source as MapLibreSource,
  type LayerProps as MapLibreLayerProps,
  type MapLayerMouseEvent as MapLibreLayerMouseEvent,
  type MapRef as MapLibreMapRef,
  type MarkerEvent as MapLibreMarkerEvent,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { Button } from "@/components/Button";
import type { DatasetFeatureCollection, LngLat } from "@/types/dataset";
import {
  buildDraftFeatures,
  buildRenderableFeatures,
  getClickedFeatureId,
  getMapCursor,
} from "./editor-helpers";
import type { EditorMode } from "./editor-types";
import {
  getMapboxAccessToken,
  getMapRenderer,
  type EditorMapSource,
  type EditorMapStyle,
} from "./map-config";

const FEATURE_SOURCE_ID = "dataset-features";
const DRAFT_SOURCE_ID = "draft-features";
const FEATURE_FILL_LAYER_ID = "dataset-fill";
const FEATURE_LINE_LAYER_ID = "dataset-line";
const FEATURE_LINE_HIT_LAYER_ID = "dataset-line-hit";
const FEATURE_POINT_LAYER_ID = "dataset-point";
const SELECTED_FILL_LAYER_ID = "selected-fill";
const SELECTED_LINE_LAYER_ID = "selected-line";
const SELECTED_LINE_HIT_LAYER_ID = "selected-line-hit";
const SELECTED_POINT_LAYER_ID = "selected-point";
const DRAFT_FILL_LAYER_ID = "draft-fill";
const DRAFT_LINE_LAYER_ID = "draft-line";
const DRAFT_POINT_LAYER_ID = "draft-point";
const INTERACTIVE_LAYER_IDS = [
  FEATURE_LINE_HIT_LAYER_ID,
  FEATURE_FILL_LAYER_ID,
  FEATURE_LINE_LAYER_ID,
  FEATURE_POINT_LAYER_ID,
  SELECTED_FILL_LAYER_ID,
  SELECTED_LINE_HIT_LAYER_ID,
  SELECTED_LINE_LAYER_ID,
  SELECTED_POINT_LAYER_ID,
];

const MAP_STYLE_ICON_MAP = {
  default: IconMap,
  satellite: IconSatellite,
  terrain: IconMountain,
  dark: IconMoon,
  nature: IconLeaf,
  light: IconSun,
} as const;

type SharedLayerProps = MapboxLayerProps | MapLibreLayerProps;

const FEATURE_FILL_LAYER: SharedLayerProps = {
  id: FEATURE_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["!=", ["get", "isSelected"], true]],
  paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.18 },
};

const FEATURE_LINE_HIT_LAYER: SharedLayerProps = {
  id: FEATURE_LINE_HIT_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: { "line-color": "#000000", "line-opacity": 0.01, "line-width": 14 },
};

const FEATURE_LINE_LAYER: SharedLayerProps = {
  id: FEATURE_LINE_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: { "line-color": "#0284c7", "line-width": 2 },
};

const FEATURE_POINT_LAYER: SharedLayerProps = {
  id: FEATURE_POINT_LAYER_ID,
  type: "circle",
  filter: ["all", ["==", ["geometry-type"], "Point"], ["!=", ["get", "isSelected"], true]],
  paint: {
    "circle-radius": 3,
    "circle-color": "#0284c7",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

const SELECTED_FILL_LAYER: SharedLayerProps = {
  id: SELECTED_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "isSelected"], true]],
  paint: { "fill-color": "#f97316", "fill-opacity": 0.18 },
};

const SELECTED_LINE_HIT_LAYER: SharedLayerProps = {
  id: SELECTED_LINE_HIT_LAYER_ID,
  type: "line",
  filter: [
    "all",
    ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
    ["==", ["get", "isSelected"], true],
  ],
  paint: { "line-color": "#000000", "line-opacity": 0.01, "line-width": 16 },
};

const SELECTED_LINE_LAYER: SharedLayerProps = {
  id: SELECTED_LINE_LAYER_ID,
  type: "line",
  filter: [
    "all",
    ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
    ["==", ["get", "isSelected"], true],
  ],
  paint: { "line-color": "#f97316", "line-width": 3 },
};

const SELECTED_POINT_LAYER: SharedLayerProps = {
  id: SELECTED_POINT_LAYER_ID,
  type: "circle",
  filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "isSelected"], true]],
  paint: {
    "circle-radius": 3.5,
    "circle-color": "#f97316",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

const DRAFT_FILL_LAYER: SharedLayerProps = {
  id: DRAFT_FILL_LAYER_ID,
  type: "fill",
  filter: ["==", ["geometry-type"], "Polygon"],
  paint: { "fill-color": "#f59e0b", "fill-opacity": 0.14 },
};

const DRAFT_LINE_LAYER: SharedLayerProps = {
  id: DRAFT_LINE_LAYER_ID,
  type: "line",
  filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
  paint: {
    "line-color": "#f59e0b",
    "line-width": 2,
    "line-dasharray": [1.5, 1.5],
  },
};

const DRAFT_POINT_LAYER: SharedLayerProps = {
  id: DRAFT_POINT_LAYER_ID,
  type: "circle",
  filter: ["==", ["geometry-type"], "Point"],
  paint: {
    "circle-radius": 2.5,
    "circle-color": "#f59e0b",
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

export type MapCanvasLayerMouseEvent = MapboxLayerMouseEvent | MapLibreLayerMouseEvent;
export type MapCanvasMarkerEvent =
  | MapboxMarkerEvent<MouseEvent>
  | MapLibreMarkerEvent<MouseEvent>;

type MapCanvasProps = {
  draftCoordinates: LngLat[];
  features: DatasetFeatureCollection;
  hoverCoordinate: LngLat | null;
  isDraggingVertex: boolean;
  isHoveringSelectableFeature: boolean;
  mapSource: EditorMapSource;
  mapStyle: EditorMapStyle;
  mapStyleUrl: string;
  mapStyleOptions: Array<{ value: string; label: string }>;
  mode: EditorMode;
  onCloseDraftLineLoop: () => void;
  onFeatureClick: (featureId: string | null) => void;
  onFinalizeDraft: () => void;
  onMapClick: (event: MapCanvasLayerMouseEvent) => void;
  onMapHover: (coordinate: LngLat | null) => void;
  onMapStyleChange: (style: EditorMapStyle) => void;
  onInsertVertex: (featureId: string, segmentIndex: number) => void;
  onSelectVertex: (event: MapCanvasMarkerEvent, featureId: string, vertexIndex: number) => void;
  onVertexDrag: (featureId: string, vertexIndex: number, coordinate: LngLat) => void;
  onVertexDragEnd: (featureId: string, vertexIndex: number, coordinate: LngLat) => void;
  onVertexDragStart: () => void;
  pendingFitBounds: [LngLat, LngLat] | null;
  selectedFeatureId: string | null;
  selectedMidpoints: Array<{ coordinate: LngLat; segmentIndex: number }>;
  selectedVertexIndex: number | null;
  selectedVertices: LngLat[];
  setIsHoveringSelectableFeature: (value: boolean) => void;
  setPendingFitBounds: (bounds: [LngLat, LngLat] | null) => void;
  viewport: { center: LngLat; zoomLevel: number };
  onViewportChange: (viewport: { center: LngLat; zoomLevel: number }) => void;
};

export function MapCanvas({
  draftCoordinates,
  features,
  hoverCoordinate,
  isDraggingVertex,
  isHoveringSelectableFeature,
  mapSource,
  mapStyle,
  mapStyleUrl,
  mapStyleOptions,
  mode,
  onCloseDraftLineLoop,
  onFeatureClick,
  onFinalizeDraft,
  onMapClick,
  onMapHover,
  onMapStyleChange,
  onInsertVertex,
  onSelectVertex,
  onVertexDrag,
  onVertexDragEnd,
  onVertexDragStart,
  pendingFitBounds,
  selectedFeatureId,
  selectedMidpoints,
  selectedVertexIndex,
  selectedVertices,
  setIsHoveringSelectableFeature,
  setPendingFitBounds,
  viewport,
  onViewportChange,
}: MapCanvasProps) {
  const mapRef = useRef<MapboxMapRef | MapLibreMapRef | null>(null);
  const center = viewport.center;
  const zoom = viewport.zoomLevel;
  const renderedFeatures = useMemo(
    () => buildRenderableFeatures(features, selectedFeatureId),
    [features, selectedFeatureId],
  );
  const draftFeatures = useMemo(
    () => buildDraftFeatures(mode, draftCoordinates, hoverCoordinate),
    [draftCoordinates, hoverCoordinate, mode],
  );
  const isMapbox = getMapRenderer(mapSource) === "mapbox";

  useEffect(() => {
    if (!pendingFitBounds || !mapRef.current) {
      return;
    }

    mapRef.current.fitBounds(pendingFitBounds, {
      padding: 64,
      duration: 800,
    });
    setPendingFitBounds(null);
  }, [pendingFitBounds, setPendingFitBounds]);

  const MapComponent: any = isMapbox ? MapboxMap : MapLibreMap;
  const LayerComponent: any = isMapbox ? MapboxLayer : MapLibreLayer;
  const MarkerComponent: any = isMapbox ? MapboxMarker : MapLibreMarker;
  const NavigationControlComponent: any = isMapbox
    ? MapboxNavigationControl
    : MapLibreNavigationControl;
  const SourceComponent: any = isMapbox ? MapboxSource : MapLibreSource;
  const mapProps: Record<string, unknown> = {
    ref: mapRef,
    latitude: center[1],
    longitude: center[0],
    zoom,
    mapStyle: mapStyleUrl,
    cursor: getMapCursor(mode, isDraggingVertex, isHoveringSelectableFeature),
    doubleClickZoom: true,
    dragPan: !isDraggingVertex,
    interactiveLayerIds: INTERACTIVE_LAYER_IDS,
    onClick: (event: MapCanvasLayerMouseEvent) => {
      onMapClick(event);
      if (mode === "select" && !getClickedFeatureId(event)) {
        onFeatureClick(null);
      }
    },
    onDblClick: (event: MapCanvasLayerMouseEvent) => {
      const clickedFeatureId = getClickedFeatureId(event);

      if (mode === "draw-line" || mode === "draw-polygon") {
        event.preventDefault();
        event.originalEvent.preventDefault();
        onFinalizeDraft();
        return;
      }

      if (clickedFeatureId) {
        event.preventDefault();
        event.originalEvent.preventDefault();
      }
    },
    onMouseMove: (event: MapCanvasLayerMouseEvent) => {
      if (mode === "select") {
        setIsHoveringSelectableFeature(Boolean(getClickedFeatureId(event)));
        return;
      }

      if (mode !== "draw-line" && mode !== "draw-polygon") {
        return;
      }

      onMapHover([event.lngLat.lng, event.lngLat.lat]);
    },
    onMouseLeave: () => {
      onMapHover(null);
      setIsHoveringSelectableFeature(false);
    },
    onMove: (event: { viewState: { longitude: number; latitude: number; zoom: number } }) => {
      onViewportChange({
        center: [event.viewState.longitude, event.viewState.latitude],
        zoomLevel: event.viewState.zoom,
      });
    },
    style: { width: "100%", height: "100%" },
  };

  if (isMapbox) {
    mapProps.mapboxAccessToken = getMapboxAccessToken();
  } else {
    mapProps.mapLib = maplibregl;
  }

  return (
    <div className="relative h-full min-h-screen">
      <MapComponent {...mapProps}>
        <SourceComponent data={renderedFeatures} id={FEATURE_SOURCE_ID} type="geojson">
          <LayerComponent {...FEATURE_LINE_HIT_LAYER} />
          <LayerComponent {...FEATURE_FILL_LAYER} />
          <LayerComponent {...FEATURE_LINE_LAYER} />
          <LayerComponent {...FEATURE_POINT_LAYER} />
          <LayerComponent {...SELECTED_FILL_LAYER} />
          <LayerComponent {...SELECTED_LINE_HIT_LAYER} />
          <LayerComponent {...SELECTED_LINE_LAYER} />
          <LayerComponent {...SELECTED_POINT_LAYER} />
        </SourceComponent>
        <SourceComponent data={draftFeatures} id={DRAFT_SOURCE_ID} type="geojson">
          <LayerComponent {...DRAFT_FILL_LAYER} />
          <LayerComponent {...DRAFT_LINE_LAYER} />
          <LayerComponent {...DRAFT_POINT_LAYER} />
        </SourceComponent>
        {mode === "draw-line" && draftCoordinates.length >= 2 ? (
          <MarkerComponent
            latitude={draftCoordinates[0][1]}
            longitude={draftCoordinates[0][0]}
            onClick={(event: MapCanvasMarkerEvent) => {
              event.originalEvent.stopPropagation();
              onCloseDraftLineLoop();
            }}
          >
            <div className="h-3 w-3 rounded-full border border-amber-500 bg-amber-200 shadow-sm" />
          </MarkerComponent>
        ) : null}
        {mode === "select" && selectedFeatureId ? (
          <>
            {selectedMidpoints.map((midpoint) => (
              <MarkerComponent
                key={`${selectedFeatureId}-midpoint-${midpoint.segmentIndex}`}
                latitude={midpoint.coordinate[1]}
                longitude={midpoint.coordinate[0]}
                onClick={() => onInsertVertex(selectedFeatureId, midpoint.segmentIndex)}
              >
                <div
                  className="h-[7px] w-[7px] rounded-full border border-orange-400 bg-orange-400/45 shadow-sm backdrop-blur-[1px]"
                  onDoubleClick={(event) => event.stopPropagation()}
                />
              </MarkerComponent>
            ))}
            {selectedVertices.map((vertex, index) => (
              <MarkerComponent
                draggable
                key={`${selectedFeatureId}-${index}`}
                latitude={vertex[1]}
                longitude={vertex[0]}
                onClick={(event: MapCanvasMarkerEvent) => onSelectVertex(event, selectedFeatureId, index)}
                onDragStart={onVertexDragStart}
                onDrag={(event: { lngLat: { lng: number; lat: number } }) => {
                  onVertexDrag(selectedFeatureId, index, [event.lngLat.lng, event.lngLat.lat]);
                }}
                onDragEnd={(event: { lngLat: { lng: number; lat: number } }) => {
                  onVertexDragEnd(selectedFeatureId, index, [event.lngLat.lng, event.lngLat.lat]);
                }}
              >
                <div
                  className={
                    index === selectedVertexIndex
                      ? "h-3 w-3 rounded-full border border-white bg-orange-700 shadow-lg"
                      : "h-2 w-2 rounded-full border border-white bg-orange-500 shadow-lg"
                  }
                  onDoubleClick={(event) => event.stopPropagation()}
                />
              </MarkerComponent>
            ))}
          </>
        ) : null}
        <NavigationControlComponent position="top-right" />
      </MapComponent>
      <div className="pointer-events-none absolute left-3 top-2 z-10">
        <div className="pointer-events-auto flex items-center rounded-xl shadow-lg">
          {mapStyleOptions.map((option) => {
            const Icon = MAP_STYLE_ICON_MAP[option.value as keyof typeof MAP_STYLE_ICON_MAP] ?? IconMap;

            return (
              <Button
                className={
                  `${mapStyle === option.value ? "bg-slate-300" : "bg-white"} h-8 min-w-8 rounded-none border-y-2 border-l-2 border-slate-500/20 px-1.5 text-slate-900 shadow-none first:rounded-l-xl last:rounded-r-xl last:border-r-2 hover:bg-slate-100`
                }
                key={option.value}
                onClick={() => onMapStyleChange(option.value as EditorMapStyle)}
                title={option.label}
                variant="ghost"
              >
                <Icon size={18} stroke={1.9} />
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
