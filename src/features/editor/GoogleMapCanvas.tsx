import {
  IconLeaf,
  IconMap,
  IconMoon,
  IconMountain,
  IconSatellite,
  IconSun,
} from "@tabler/icons-react";
import {
  APIProvider,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  Map,
  useMap,
  type MapCameraChangedEvent,
  type MapMouseEvent as GoogleMapMouseEvent,
} from "@vis.gl/react-google-maps";
import type { FeatureCollection, Geometry } from "geojson";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { LngLat, LngLatBounds } from "@/types/dataset";
import { buildDraftFeatures, buildRenderableFeatures, getMapCursor } from "./editor-helpers";
import type { MapCanvasLayerMouseEvent, MapCanvasMarkerEvent, MapCanvasProps } from "./MapCanvas";

const MAP_STYLE_ICON_MAP = {
  default: IconMap,
  satellite: IconSatellite,
  terrain: IconMountain,
  dark: IconMoon,
  nature: IconLeaf,
  light: IconSun,
} as const;

const GOOGLE_MAPS_LIBRARIES = ["marker"] as const;

type GoogleMapCanvasProps = MapCanvasProps;

export function GoogleMapCanvas({
  draftCoordinates,
  features,
  hoverCoordinate,
  isDraggingVertex,
  isHoveringSelectableFeature,
  mapActions,
  mapState,
  mode,
  onCloseDraftLineLoop,
  onFinalizeDraft,
  onMapClick,
  onMapHover,
  onInsertVertex,
  onSelectVertex,
  onVertexDrag,
  onVertexDragEnd,
  onVertexDragStart,
  selectedFeatureId,
  selectedMidpoints,
  selectedVertexIndex,
  selectedVertices,
  setIsHoveringSelectableFeature,
}: GoogleMapCanvasProps) {
  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const googleMapsId = import.meta.env.VITE_GOOGLE_MAPS_ID?.trim() ?? "";
  const renderedFeatures = useMemo(
    () => buildRenderableFeatures(features, selectedFeatureId),
    [features, selectedFeatureId],
  );
  const draftFeatures = useMemo(
    () => buildDraftFeatures(mode, draftCoordinates, hoverCoordinate),
    [draftCoordinates, hoverCoordinate, mode],
  );

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

  if (!googleMapsApiKey) {
    return (
      <div className="relative h-full min-h-screen">
        <div className="flex h-full min-h-screen items-center justify-center bg-slate-100">
          <div className="rounded-3xl border border-sky-100 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
            Google Maps is unavailable. Set <code>VITE_GOOGLE_MAPS_API_KEY</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-screen">
      <APIProvider apiKey={googleMapsApiKey} libraries={[...GOOGLE_MAPS_LIBRARIES]}>
        <Map
          center={{ lat: mapState.viewport.center[1], lng: mapState.viewport.center[0] }}
          clickableIcons={false}
          disableDoubleClickZoom={mode === "draw-line" || mode === "draw-polygon"}
          draggable={!isDraggingVertex}
          mapId={googleMapsId || undefined}
          onCameraChanged={(event: MapCameraChangedEvent) => {
            mapActions.setViewport({
              center: [event.detail.center.lng, event.detail.center.lat],
              zoomLevel: event.detail.zoom,
            });
          }}
          onDblclick={(event: GoogleMapMouseEvent) => {
            if (mode !== "draw-line" && mode !== "draw-polygon") {
              return;
            }

            event.stop();
            event.domEvent?.preventDefault?.();
            onFinalizeDraft();
          }}
          onMousemove={(event: GoogleMapMouseEvent) => {
            if (mode !== "draw-line" && mode !== "draw-polygon") {
              return;
            }

            const latLng = event.detail.latLng;

            if (!latLng) {
              return;
            }

            onMapHover([latLng.lng, latLng.lat]);
          }}
          onMouseout={() => {
            onMapHover(null);
            setIsHoveringSelectableFeature(false);
          }}
          style={{ width: "100%", height: "100%" }}
          zoom={mapState.viewport.zoomLevel}
        >
          <GoogleMapLayers
            draftFeatures={draftFeatures}
            isDraggingVertex={isDraggingVertex}
            isHoveringSelectableFeature={isHoveringSelectableFeature}
            mode={mode}
            onMapClick={onMapClick}
            pendingFitBounds={mapState.pendingFitBounds}
            renderedFeatures={renderedFeatures}
            selectedFeatureId={selectedFeatureId}
            setIsHoveringSelectableFeature={setIsHoveringSelectableFeature}
            setPendingFitBounds={mapActions.setPendingFitBounds}
          />

          {mode === "draw-line" && draftCoordinates.length >= 2 ? (
            <AdvancedMarker
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              clickable
              onClick={(event) => {
                event.domEvent?.stopPropagation?.();
                onCloseDraftLineLoop();
              }}
              position={{ lat: draftCoordinates[0][1], lng: draftCoordinates[0][0] }}
            >
              <div className="h-3 w-3 rounded-full border border-amber-500 bg-amber-200 shadow-sm" />
            </AdvancedMarker>
          ) : null}

          {mode === "select" && selectedFeatureId ? (
            <>
              {selectedMidpoints.map((midpoint) => (
                <AdvancedMarker
                  anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                  clickable
                  key={`${selectedFeatureId}-midpoint-${midpoint.segmentIndex}`}
                  onClick={(event) => {
                    event.domEvent?.stopPropagation?.();
                    onInsertVertex(selectedFeatureId, midpoint.segmentIndex);
                  }}
                  position={{
                    lat: midpoint.coordinate[1],
                    lng: midpoint.coordinate[0],
                  }}
                >
                  <div
                    className="h-[7px] w-[7px] rounded-full border border-orange-400 bg-orange-400/45 shadow-sm backdrop-blur-[1px]"
                    onDoubleClick={(event) => event.stopPropagation()}
                  />
                </AdvancedMarker>
              ))}

              {selectedVertices.map((vertex, index) => (
                <AdvancedMarker
                  anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                  clickable
                  draggable
                  key={`${selectedFeatureId}-${index}`}
                  onClick={(event) => {
                    onSelectVertex(createMarkerEvent(event.domEvent), selectedFeatureId, index);
                  }}
                  onDrag={(event) => {
                    const latLng = event.latLng;

                    if (!latLng) {
                      return;
                    }

                    onVertexDrag(selectedFeatureId, index, [latLng.lng(), latLng.lat()]);
                  }}
                  onDragEnd={(event) => {
                    const latLng = event.latLng;

                    if (!latLng) {
                      return;
                    }

                    onVertexDragEnd(selectedFeatureId, index, [latLng.lng(), latLng.lat()]);
                  }}
                  onDragStart={onVertexDragStart}
                  position={{ lat: vertex[1], lng: vertex[0] }}
                >
                  <div
                    className={
                      index === selectedVertexIndex
                        ? "h-3 w-3 rounded-full border border-white bg-orange-700 shadow-lg"
                        : "h-2 w-2 rounded-full border border-white bg-orange-500 shadow-lg"
                    }
                    onDoubleClick={(event) => event.stopPropagation()}
                  />
                </AdvancedMarker>
              ))}
            </>
          ) : null}
        </Map>
      </APIProvider>
    </div>
  );
}

function GoogleMapLayers({
  draftFeatures,
  isDraggingVertex,
  isHoveringSelectableFeature,
  mode,
  onMapClick,
  pendingFitBounds,
  renderedFeatures,
  selectedFeatureId,
  setIsHoveringSelectableFeature,
  setPendingFitBounds,
}: {
  draftFeatures: FeatureCollection<Geometry>;
  isDraggingVertex: boolean;
  isHoveringSelectableFeature: boolean;
  mode: MapCanvasProps["mode"];
  onMapClick: MapCanvasProps["onMapClick"];
  pendingFitBounds: MapCanvasProps["mapState"]["pendingFitBounds"];
  renderedFeatures: FeatureCollection<Geometry>;
  selectedFeatureId: MapCanvasProps["selectedFeatureId"];
  setIsHoveringSelectableFeature: MapCanvasProps["setIsHoveringSelectableFeature"];
  setPendingFitBounds: MapCanvasProps["mapActions"]["setPendingFitBounds"];
}) {
  const map = useMap();
  const renderedLayerRef = useRef<google.maps.Data | null>(null);
  const draftLayerRef = useRef<google.maps.Data | null>(null);
  const lastFeatureClickAtRef = useRef(0);
  const cursor = getMapCursor(mode, isDraggingVertex, isHoveringSelectableFeature);

  useEffect(() => {
    if (!map) {
      return;
    }

    if (!renderedLayerRef.current) {
      renderedLayerRef.current = new google.maps.Data();
    }

    if (!draftLayerRef.current) {
      draftLayerRef.current = new google.maps.Data();
    }

    renderedLayerRef.current.setMap(map);
    draftLayerRef.current.setMap(map);

    return () => {
      renderedLayerRef.current?.setMap(null);
      draftLayerRef.current?.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (!renderedLayerRef.current) {
      return;
    }

    replaceLayerData(renderedLayerRef.current, renderedFeatures);
    renderedLayerRef.current.setStyle((feature) =>
      getRenderedFeatureStyle(feature, selectedFeatureId),
    );
  }, [renderedFeatures, selectedFeatureId]);

  useEffect(() => {
    if (!draftLayerRef.current) {
      return;
    }

    replaceLayerData(draftLayerRef.current, draftFeatures);
    draftLayerRef.current.setStyle(getDraftFeatureStyle);
  }, [draftFeatures]);

  useEffect(() => {
    const renderedLayer = renderedLayerRef.current;

    if (!renderedLayer) {
      return;
    }

    const clickListener = renderedLayer.addListener("click", (event: google.maps.Data.MouseEvent) => {
      const latLng = event.latLng?.toJSON();

      if (!latLng) {
        return;
      }

      event.domEvent?.stopPropagation?.();
      lastFeatureClickAtRef.current = performance.now();
      onMapClick(
        createLayerMouseEvent({
          domEvent: event.domEvent,
          features: [{ properties: getDataFeatureProperties(event.feature) }],
          latLng,
        }),
      );
    });

    const mouseOverListener = renderedLayer.addListener("mouseover", () => {
      if (mode === "select") {
        setIsHoveringSelectableFeature(true);
      }
    });

    const mouseOutListener = renderedLayer.addListener("mouseout", () => {
      if (mode === "select") {
        setIsHoveringSelectableFeature(false);
      }
    });

    return () => {
      clickListener.remove();
      mouseOverListener.remove();
      mouseOutListener.remove();
    };
  }, [mode, onMapClick, setIsHoveringSelectableFeature]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
      const latLng = event.latLng?.toJSON();

      if (!latLng) {
        return;
      }

      if (performance.now() - lastFeatureClickAtRef.current < 80) {
        return;
      }

      onMapClick(
        createLayerMouseEvent({
          domEvent: event.domEvent,
          latLng,
        }),
      );
    });

    return () => {
      clickListener.remove();
    };
  }, [map, onMapClick]);

  useEffect(() => {
    if (!map || !pendingFitBounds) {
      return;
    }

    const [southWest, northEast] = pendingFitBounds;

    map.fitBounds(
      {
        east: northEast[0],
        north: northEast[1],
        south: southWest[1],
        west: southWest[0],
      },
      64,
    );
    setPendingFitBounds(null);
  }, [map, pendingFitBounds, setPendingFitBounds]);

  useEffect(() => {
    if (mode !== "select") {
      setIsHoveringSelectableFeature(false);
    }
  }, [mode, setIsHoveringSelectableFeature]);

  useEffect(() => {
    if (!map) {
      return;
    }

    const mapElement = map.getDiv();
    const previousCursor = mapElement.style.cursor;
    const previousDraggableCursor = map.get("draggableCursor") as string | undefined;
    const previousDraggingCursor = map.get("draggingCursor") as string | undefined;

    map.setOptions({
      draggableCursor: cursor,
      draggingCursor: "grabbing",
    });
    mapElement.style.cursor = cursor;

    return () => {
      map.setOptions({
        draggableCursor: previousDraggableCursor,
        draggingCursor: previousDraggingCursor,
      });
      mapElement.style.cursor = previousCursor;
    };
  }, [cursor, map]);

  return null;
}

function getRenderedFeatureStyle(
  feature: google.maps.Data.Feature,
  selectedFeatureId: string | null,
): google.maps.Data.StyleOptions {
  const geometryType = feature.getGeometry()?.getType();
  const featureId = String(feature.getProperty("featureId") ?? "");
  const isSelected = featureId.length > 0 && featureId === selectedFeatureId;

  if (geometryType === "Point") {
    return {
      clickable: true,
      icon: {
        fillColor: isSelected ? "#f97316" : "#0284c7",
        fillOpacity: 1,
        path: google.maps.SymbolPath.CIRCLE,
        scale: isSelected ? 4 : 3.5,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      zIndex: isSelected ? 3 : 1,
    };
  }

  if (geometryType === "Polygon") {
    return {
      clickable: true,
      fillColor: isSelected ? "#f97316" : "#0ea5e9",
      fillOpacity: 0.18,
      strokeColor: isSelected ? "#f97316" : "#0284c7",
      strokeWeight: isSelected ? 3 : 2,
      zIndex: isSelected ? 2 : 1,
    };
  }

  return {
    clickable: true,
    strokeColor: isSelected ? "#f97316" : "#0284c7",
    strokeWeight: isSelected ? 4 : 3,
    zIndex: isSelected ? 2 : 1,
  };
}

function getDraftFeatureStyle(feature: google.maps.Data.Feature): google.maps.Data.StyleOptions {
  const geometryType = feature.getGeometry()?.getType();

  if (geometryType === "Point") {
    return {
      clickable: false,
      icon: {
        fillColor: "#f59e0b",
        fillOpacity: 1,
        path: google.maps.SymbolPath.CIRCLE,
        scale: 2.8,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      zIndex: 4,
    };
  }

  if (geometryType === "Polygon") {
    return {
      clickable: false,
      fillColor: "#f59e0b",
      fillOpacity: 0.14,
      strokeColor: "#f59e0b",
      strokeWeight: 2,
      zIndex: 3,
    };
  }

  return {
    clickable: false,
    strokeColor: "#f59e0b",
    strokeWeight: 2,
    zIndex: 3,
  };
}

function replaceLayerData(layer: google.maps.Data, data: FeatureCollection<Geometry>) {
  layer.forEach((feature) => {
    layer.remove(feature);
  });

  layer.addGeoJson(data as object);
}

function getDataFeatureProperties(feature: google.maps.Data.Feature) {
  const properties: Record<string, unknown> = {};

  feature.forEachProperty((value, key) => {
    properties[key] = value;
  });

  return properties;
}

function createLayerMouseEvent({
  domEvent,
  features,
  latLng,
}: {
  domEvent?: MouseEvent | TouchEvent | PointerEvent | KeyboardEvent | Event;
  features?: Array<{ properties?: Record<string, unknown> | null }>;
  latLng: google.maps.LatLngLiteral;
}): MapCanvasLayerMouseEvent {
  const detail = domEvent instanceof MouseEvent ? domEvent.detail : 1;
  const preventDefault = () => {
    domEvent?.preventDefault?.();
  };

  return {
    features,
    lngLat: {
      lat: latLng.lat,
      lng: latLng.lng,
    },
    originalEvent: {
      detail,
      preventDefault,
    },
    preventDefault,
  };
}

function createMarkerEvent(domEvent?: Event): MapCanvasMarkerEvent {
  return {
    originalEvent: {
      stopPropagation: () => {
        domEvent?.stopPropagation?.();
      },
    },
  };
}
