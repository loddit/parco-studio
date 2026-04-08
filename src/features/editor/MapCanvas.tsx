import { useCallback, useEffect, useMemo, useRef } from "react";
import { GeocodingBar } from "./GeocodingBar";
import { MapStyleSwitcher } from "./MapStyleSwitcher";
import type { DatasetFeatureCollection, LngLat, LngLatBounds } from "@/types/dataset";
import {
  buildDraftFeatures,
  buildRenderableFeatures,
  getClickedFeatureId,
  getMapCursor,
  type LinkableLineEndpoint,
  type RouteAnnotation,
} from "./editor-helpers";
import type { EditorMode } from "./editor-types";
import { GoogleMapCanvas } from "./GoogleMapCanvas";
import {
  Layer,
  Map,
  MapGLProvider,
  type MapGLMapProps,
  Marker,
  NavigationControl,
  Source,
  type MapGLLayerMouseEvent,
  type MapGLLayerProps,
  type MapGLMapRef,
  type MapGLMarkerEvent,
} from "./mapGL";
import type { EditorMapActions, EditorMapState } from "./useEditorMapState";

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

const FEATURE_FILL_LAYER: MapGLLayerProps<"fill"> = {
  id: FEATURE_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["!=", ["get", "isSelected"], true]],
  paint: { "fill-color": "#0ea5e9", "fill-opacity": 0.18 },
};

const FEATURE_LINE_HIT_LAYER: MapGLLayerProps<"line"> = {
  id: FEATURE_LINE_HIT_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: { "line-color": "#000000", "line-opacity": 0.01, "line-width": 14 },
};

const FEATURE_LINE_LAYER: MapGLLayerProps<"line"> = {
  id: FEATURE_LINE_LAYER_ID,
  type: "line",
  filter: ["all", ["==", ["geometry-type"], "LineString"], ["!=", ["get", "isSelected"], true]],
  paint: { "line-color": "#0284c7", "line-width": 2 },
};

const FEATURE_POINT_LAYER: MapGLLayerProps<"circle"> = {
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

const SELECTED_FILL_LAYER: MapGLLayerProps<"fill"> = {
  id: SELECTED_FILL_LAYER_ID,
  type: "fill",
  filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "isSelected"], true]],
  paint: { "fill-color": "#f97316", "fill-opacity": 0.18 },
};

const SELECTED_LINE_HIT_LAYER: MapGLLayerProps<"line"> = {
  id: SELECTED_LINE_HIT_LAYER_ID,
  type: "line",
  filter: [
    "all",
    ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
    ["==", ["get", "isSelected"], true],
  ],
  paint: { "line-color": "#000000", "line-opacity": 0.01, "line-width": 16 },
};

const SELECTED_LINE_LAYER: MapGLLayerProps<"line"> = {
  id: SELECTED_LINE_LAYER_ID,
  type: "line",
  filter: [
    "all",
    ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
    ["==", ["get", "isSelected"], true],
  ],
  paint: { "line-color": "#f97316", "line-width": 3 },
};

const SELECTED_POINT_LAYER: MapGLLayerProps<"circle"> = {
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

const DRAFT_FILL_LAYER: MapGLLayerProps<"fill"> = {
  id: DRAFT_FILL_LAYER_ID,
  type: "fill",
  filter: ["==", ["geometry-type"], "Polygon"],
  paint: { "fill-color": "#f59e0b", "fill-opacity": 0.14 },
};

const DRAFT_LINE_LAYER: MapGLLayerProps<"line"> = {
  id: DRAFT_LINE_LAYER_ID,
  type: "line",
  filter: ["in", ["geometry-type"], ["literal", ["LineString", "Polygon"]]],
  paint: {
    "line-color": "#f59e0b",
    "line-width": 2,
    "line-dasharray": [1.5, 1.5],
  },
};

const DRAFT_POINT_LAYER: MapGLLayerProps<"circle"> = {
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

export type MapCanvasLayerMouseEvent = {
  features?: Array<{ properties?: Record<string, unknown> | null }>;
  lngLat: { lat: number; lng: number };
  originalEvent: { detail: number; preventDefault: () => void };
  preventDefault: () => void;
};

export type MapCanvasMarkerEvent = {
  originalEvent: { stopPropagation: () => void };
};

export type MapCanvasProps = {
  draftCoordinates: LngLat[];
  features: DatasetFeatureCollection;
  hoverCoordinate: LngLat | null;
  isDraggingVertex: boolean;
  isHoveringSelectableFeature: boolean;
  linkableLineEndpoints: LinkableLineEndpoint[];
  mapActions: Pick<EditorMapActions, "setMapStyle" | "setPendingFitBounds" | "setViewport">;
  mapState: Pick<
    EditorMapState,
    | "mapRenderer"
    | "mapStyle"
    | "mapStyleOptions"
    | "mapStyleUrl"
    | "pendingFitBounds"
    | "viewport"
  >;
  mode: EditorMode;
  onCloseDraftLineLoop: () => void;
  onFeatureClick: (featureId: string | null) => void;
  onFinalizeDraft: () => void;
  onLinkEndpointClick: (featureId: string, vertexIndex: number) => void;
  onMapClick: (event: MapCanvasLayerMouseEvent) => void;
  onMapHover: (coordinate: LngLat | null) => void;
  onInsertVertex: (featureId: string, segmentIndex: number) => void;
  onSelectVertex: (event: MapCanvasMarkerEvent, featureId: string, vertexIndex: number) => void;
  onVertexDrag: (featureId: string, vertexIndex: number, coordinate: LngLat) => void;
  onVertexDragEnd: (featureId: string, vertexIndex: number, coordinate: LngLat) => void;
  onVertexDragStart: () => void;
  pendingLinkEndpoint: { featureId: string; vertexIndex: number } | null;
  selectedFeatureId: string | null;
  selectedMidpoints: Array<{ coordinate: LngLat; segmentIndex: number }>;
  selectedRouteAnnotations: RouteAnnotation[];
  selectedVertexIndex: number | null;
  selectedVertices: LngLat[];
  setIsHoveringSelectableFeature: (value: boolean) => void;
};

export function MapCanvas({
  mapState,
  ...props
}: MapCanvasProps) {
  if (mapState.mapRenderer === "google") {
    return <GoogleMapCanvas {...props} mapState={mapState} />;
  }

  return <MapGLCanvas {...props} mapState={mapState} />;
}

function MapGLCanvas({
  draftCoordinates,
  features,
  hoverCoordinate,
  isDraggingVertex,
  isHoveringSelectableFeature,
  linkableLineEndpoints,
  mapActions,
  mapState,
  mode,
  onCloseDraftLineLoop,
  onFeatureClick,
  onFinalizeDraft,
  onLinkEndpointClick,
  onMapClick,
  onMapHover,
  onInsertVertex,
  onSelectVertex,
  onVertexDrag,
  onVertexDragEnd,
  onVertexDragStart,
  pendingLinkEndpoint,
  selectedFeatureId,
  selectedMidpoints,
  selectedRouteAnnotations,
  selectedVertexIndex,
  selectedVertices,
  setIsHoveringSelectableFeature,
}: MapCanvasProps) {
  const mapGLRef = useRef<MapGLMapRef | null>(null);
  const center = mapState.viewport.center;
  const zoom = mapState.viewport.zoomLevel;
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const isLinkModeActive = pendingLinkEndpoint !== null;

  const handleLocationSelect = useCallback(
    ({ center: locationCenter, bounds }: { center: LngLat; bounds?: LngLatBounds }) => {
      if (bounds) {
        mapActions.setPendingFitBounds(bounds);
        return;
      }

      mapActions.setViewport({
        center: locationCenter,
        zoomLevel: mapState.viewport.zoomLevel,
      });
    },
    [mapActions, mapState.viewport.zoomLevel],
  );
  const renderedFeatures = useMemo(
    () => buildRenderableFeatures(features, selectedFeatureId),
    [features, selectedFeatureId],
  );
  const draftFeatures = useMemo(
    () => buildDraftFeatures(mode, draftCoordinates, hoverCoordinate),
    [draftCoordinates, hoverCoordinate, mode],
  );
  const isMapbox = mapState.mapRenderer === "mapbox";

  useEffect(() => {
    if (!mapState.pendingFitBounds || !mapGLRef.current) {
      return;
    }

    mapGLRef.current.fitBounds(mapState.pendingFitBounds, {
      padding: 64,
      duration: 800,
    });
    mapActions.setPendingFitBounds(null);
  }, [mapActions, mapState.pendingFitBounds]);

  const mapProps: MapGLMapProps = {
    latitude: center[1],
    longitude: center[0],
    zoom,
    mapStyle: mapState.mapStyleUrl,
    cursor: getMapCursor(mode, isDraggingVertex, isHoveringSelectableFeature),
    doubleClickZoom: true,
    dragPan: !isDraggingVertex,
    interactiveLayerIds: INTERACTIVE_LAYER_IDS,
    onClick: (event: MapGLLayerMouseEvent) => {
      onMapClick(event as unknown as MapCanvasLayerMouseEvent);
      if (mode === "select" && !getClickedFeatureId(event)) {
        onFeatureClick(null);
      }
    },
    onDblClick: (event: MapGLLayerMouseEvent) => {
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
    onMouseMove: (event: MapGLLayerMouseEvent) => {
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
      mapActions.setViewport({
        center: [event.viewState.longitude, event.viewState.latitude],
        zoomLevel: event.viewState.zoom,
      });
    },
    style: { width: "100%", height: "100%" },
  };

  if (isMapbox) {
    Object.assign(mapProps, {
      bearing: 0,
      pitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
    });
  } else {
    Object.assign(mapProps, {
      dragRotate: false,
      pitchWithRotate: false,
    });
  }

  return (
    <div className="relative h-full min-h-screen">
      <MapGLProvider renderer={mapState.mapRenderer}>
        <Map {...mapProps} ref={mapGLRef}>
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
              onClick={(event: MapGLMarkerEvent) => {
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
                  draggable={!isLinkModeActive}
                  key={`${selectedFeatureId}-${index}`}
                  latitude={vertex[1]}
                  longitude={vertex[0]}
                  onClick={(event: MapGLMarkerEvent) => {
                    if (isLinkModeActive && (index === 0 || index === selectedVertices.length - 1)) {
                      event.originalEvent.stopPropagation();
                      onLinkEndpointClick(selectedFeatureId, index);
                      return;
                    }

                    onSelectVertex(event as unknown as MapCanvasMarkerEvent, selectedFeatureId, index);
                  }}
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
                </Marker>
              ))}
              {selectedRouteAnnotations.map((annotation, index) => (
                <Marker
                  anchor="bottom"
                  key={`${selectedFeatureId}-annotation-${annotation.kind}-${index}`}
                  latitude={annotation.coordinate[1]}
                  longitude={annotation.coordinate[0]}
                  offset={[0, -4]}
                >
                  <RouteAnnotationBadge kind={annotation.kind} label={annotation.label} />
                </Marker>
              ))}
            </>
          ) : null}
          {mode === "select" && isLinkModeActive
            ? linkableLineEndpoints
                .filter(
                  (endpoint) =>
                    endpoint.featureId !== selectedFeatureId ||
                    !selectedVertices.some(
                      (_, index) =>
                        index === endpoint.vertexIndex &&
                        (index === 0 || index === selectedVertices.length - 1),
                    ),
                )
                .map((endpoint) => {
                  const isSource =
                    pendingLinkEndpoint.featureId === endpoint.featureId &&
                    pendingLinkEndpoint.vertexIndex === endpoint.vertexIndex;

                  return (
                    <Marker
                      key={`link-endpoint-${endpoint.featureId}-${endpoint.vertexIndex}`}
                      latitude={endpoint.coordinate[1]}
                      longitude={endpoint.coordinate[0]}
                      onClick={(event: MapGLMarkerEvent) => {
                        event.originalEvent.stopPropagation();
                        onLinkEndpointClick(endpoint.featureId, endpoint.vertexIndex);
                      }}
                    >
                      <div
                        className={
                          isSource
                            ? "h-4 w-4 rounded-full border-2 border-white bg-sky-600 shadow-lg ring-4 ring-sky-200/80"
                            : "h-3 w-3 rounded-full border-2 border-white bg-sky-500 shadow-lg ring-2 ring-sky-100/90"
                        }
                      />
                    </Marker>
                  );
                })
            : null}
          <NavigationControl position="top-right" />
        </Map>
      </MapGLProvider>
      <div className="pointer-events-none absolute left-1 top-0 z-10">
        <div className="pointer-events-auto flex items-start gap-2 px-2 py-2">
          <MapStyleSwitcher
            activeStyle={mapState.mapStyle}
            onSelect={mapActions.setMapStyle}
            options={mapState.mapStyleOptions}
          />
          <GeocodingBar
            googleMapsApiKey={googleMapsApiKey}
            onLocationSelect={handleLocationSelect}
          />
        </div>
      </div>
    </div>
  );
}

function RouteAnnotationBadge({
  kind,
  label,
}: {
  kind: RouteAnnotation["kind"];
  label: string;
}) {
  const className =
    kind === "distance"
      ? "text-slate-600"
      : kind === "start"
        ? "text-emerald-700"
        : "text-rose-700";

  return (
    <div className={`-translate-y-1 whitespace-nowrap text-[11px] font-semibold drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] ${className}`}>
      {label}
    </div>
  );
}
