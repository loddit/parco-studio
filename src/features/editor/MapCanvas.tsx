import { useEffect, useRef } from "react";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
  type MarkerEvent,
  type ViewStateChangeEvent,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import type { DatasetFeatureCollection, LngLat } from "@/types/dataset";
import {
  buildDraftFeatures,
  buildRenderableFeatures,
  getClickedFeatureId,
  getMapCursor,
} from "./editor-helpers";
import type { EditorMode } from "./editor-types";

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

const FEATURE_FILL_LAYER: LayerProps = {
  id: FEATURE_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["!=", ["get", "isSelected"], true]],
  paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.18 },
};

const FEATURE_LINE_HIT_LAYER: LayerProps = {
  id: FEATURE_LINE_HIT_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: { "line-color": "#000000", "line-opacity": 0.01, "line-width": 14 },
};

const FEATURE_LINE_LAYER: LayerProps = {
  id: FEATURE_LINE_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: { "line-color": "#0284c7", "line-width": 2 },
};

const FEATURE_POINT_LAYER: LayerProps = {
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

const SELECTED_FILL_LAYER: LayerProps = {
  id: SELECTED_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "isSelected"], true]],
  paint: { "fill-color": "#f97316", "fill-opacity": 0.18 },
};

const SELECTED_LINE_HIT_LAYER: LayerProps = {
  id: SELECTED_LINE_HIT_LAYER_ID,
  type: "line",
  filter: [
    "all",
    ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
    ["==", ["get", "isSelected"], true],
  ],
  paint: { "line-color": "#000000", "line-opacity": 0.01, "line-width": 16 },
};

const SELECTED_LINE_LAYER: LayerProps = {
  id: SELECTED_LINE_LAYER_ID,
  type: "line",
  filter: [
    "all",
    ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
    ["==", ["get", "isSelected"], true],
  ],
  paint: { "line-color": "#f97316", "line-width": 3 },
};

const SELECTED_POINT_LAYER: LayerProps = {
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

const DRAFT_FILL_LAYER: LayerProps = {
  id: DRAFT_FILL_LAYER_ID,
  type: "fill",
  filter: ["==", ["geometry-type"], "Polygon"],
  paint: { "fill-color": "#f59e0b", "fill-opacity": 0.14 },
};

const DRAFT_LINE_LAYER: LayerProps = {
  id: DRAFT_LINE_LAYER_ID,
  type: "line",
  filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
  paint: {
    "line-color": "#f59e0b",
    "line-width": 2,
    "line-dasharray": [1.5, 1.5],
  },
};

const DRAFT_POINT_LAYER: LayerProps = {
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

type MapCanvasProps = {
  draftCoordinates: LngLat[];
  features: DatasetFeatureCollection;
  hoverCoordinate: LngLat | null;
  isDraggingVertex: boolean;
  isHoveringSelectableFeature: boolean;
  mode: EditorMode;
  onCloseDraftLineLoop: () => void;
  onFeatureClick: (featureId: string | null) => void;
  onFinalizeDraft: () => void;
  onMapClick: (event: MapLayerMouseEvent) => void;
  onMapHover: (coordinate: LngLat | null) => void;
  onInsertVertex: (featureId: string, segmentIndex: number) => void;
  onSelectVertex: (event: MarkerEvent<MouseEvent>, featureId: string, vertexIndex: number) => void;
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
  mode,
  onCloseDraftLineLoop,
  onFeatureClick,
  onFinalizeDraft,
  onMapClick,
  onMapHover,
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
  const mapRef = useRef<MapRef | null>(null);
  const mapLibreStyleUrl =
    import.meta.env.VITE_MAPLIBRE_STYLE_URL || "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  const center = viewport.center;
  const zoom = viewport.zoomLevel;
  const renderedFeatures = buildRenderableFeatures(features, selectedFeatureId);
  const draftFeatures = buildDraftFeatures(mode, draftCoordinates, hoverCoordinate);

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

  return (
    <div className="h-full min-h-screen">
      <Map
        ref={mapRef}
        latitude={center[1]}
        mapLib={maplibregl}
        mapStyle={mapLibreStyleUrl}
        longitude={center[0]}
        cursor={getMapCursor(mode, isDraggingVertex, isHoveringSelectableFeature)}
        doubleClickZoom
        dragPan={!isDraggingVertex}
        interactiveLayerIds={INTERACTIVE_LAYER_IDS}
        onClick={(event) => {
          onMapClick(event);
          if (mode === "select" && !getClickedFeatureId(event)) {
            onFeatureClick(null);
          }
        }}
        onDblClick={(event) => {
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
        }}
        onMouseMove={(event) => {
          if (mode === "select") {
            setIsHoveringSelectableFeature(Boolean(getClickedFeatureId(event)));
            return;
          }

          if (mode !== "draw-line" && mode !== "draw-polygon") {
            return;
          }

          onMapHover([event.lngLat.lng, event.lngLat.lat]);
        }}
        onMouseLeave={() => {
          onMapHover(null);
          setIsHoveringSelectableFeature(false);
        }}
        onMove={(event: ViewStateChangeEvent) => {
          onViewportChange({
            center: [event.viewState.longitude, event.viewState.latitude],
            zoomLevel: event.viewState.zoom,
          });
        }}
        style={{ width: "100%", height: "100%" }}
        zoom={zoom}
      >
        <Source data={renderedFeatures} id={FEATURE_SOURCE_ID} type="geojson">
          <Layer {...FEATURE_LINE_HIT_LAYER} />
          <Layer {...FEATURE_FILL_LAYER} />
          <Layer {...FEATURE_LINE_LAYER} />
          <Layer {...FEATURE_POINT_LAYER} />
          <Layer {...SELECTED_FILL_LAYER} />
          <Layer {...SELECTED_LINE_HIT_LAYER} />
          <Layer {...SELECTED_LINE_LAYER} />
          <Layer {...SELECTED_POINT_LAYER} />
        </Source>
        <Source data={draftFeatures} id={DRAFT_SOURCE_ID} type="geojson">
          <Layer {...DRAFT_FILL_LAYER} />
          <Layer {...DRAFT_LINE_LAYER} />
          <Layer {...DRAFT_POINT_LAYER} />
        </Source>
        {mode === "draw-line" && draftCoordinates.length >= 2 ? (
          <Marker
            latitude={draftCoordinates[0][1]}
            longitude={draftCoordinates[0][0]}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onCloseDraftLineLoop();
            }}
          >
            <div className="h-3 w-3 rounded-full border border-amber-500 bg-amber-200 shadow-sm" />
          </Marker>
        ) : null}
        {mode === "select" && selectedFeatureId ? (
          <>
            {selectedMidpoints.map((midpoint) => (
              <Marker
                key={`${selectedFeatureId}-midpoint-${midpoint.segmentIndex}`}
                latitude={midpoint.coordinate[1]}
                longitude={midpoint.coordinate[0]}
                onClick={() => onInsertVertex(selectedFeatureId, midpoint.segmentIndex)}
              >
                <div
                  className="h-[7px] w-[7px] rounded-full border border-orange-400 bg-orange-400/45 shadow-sm backdrop-blur-[1px]"
                  onDoubleClick={(event) => event.stopPropagation()}
                />
              </Marker>
            ))}
            {selectedVertices.map((vertex, index) => (
              <Marker
                draggable
                key={`${selectedFeatureId}-${index}`}
                latitude={vertex[1]}
                longitude={vertex[0]}
                onClick={(event) => onSelectVertex(event, selectedFeatureId, index)}
                onDragStart={onVertexDragStart}
                onDrag={(event) => {
                  onVertexDrag(selectedFeatureId, index, [event.lngLat.lng, event.lngLat.lat]);
                }}
                onDragEnd={(event) => {
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
              </Marker>
            ))}
          </>
        ) : null}
        <NavigationControl position="top-right" />
      </Map>
    </div>
  );
}
