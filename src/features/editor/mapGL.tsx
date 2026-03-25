import {
  createContext,
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type ReactNode,
} from "react";
import MapboxMap, {
  Layer as MapboxLayer,
  Marker as MapboxMarker,
  NavigationControl as MapboxNavigationControl,
  Source as MapboxSource,
  useMap as useMapbox,
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
  useMap as useMaplibre,
  type LayerProps as MapLibreLayerProps,
  type MapLayerMouseEvent as MapLibreLayerMouseEvent,
  type MapRef as MapLibreMapRef,
  type MarkerEvent as MapLibreMarkerEvent,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import type { GeoJSONSourceSpecification, LayerSpecification } from "mapbox-gl";
import { getMapboxAccessToken, type EditorMapRenderer } from "./map-config";

type MapGLContextValue = {
  renderer: EditorMapRenderer;
};

const MapGLContext = createContext<MapGLContextValue | null>(null);

type MapboxMapProps = ComponentPropsWithoutRef<typeof MapboxMap>;
type MapLibreMapProps = ComponentPropsWithoutRef<typeof MapLibreMap>;
type MapboxSourceProps = ComponentPropsWithoutRef<typeof MapboxSource>;
type MapLibreSourceProps = ComponentPropsWithoutRef<typeof MapLibreSource>;
type MapboxGeoJSONSourceProps = Extract<MapboxSourceProps, { type: "geojson" }>;
type MapLibreGeoJSONSourceProps = Extract<MapLibreSourceProps, { type: "geojson" }>;
type MapboxMarkerProps = ComponentPropsWithoutRef<typeof MapboxMarker>;
type MapLibreMarkerProps = ComponentPropsWithoutRef<typeof MapLibreMarker>;
type MapboxNavigationControlProps = ComponentPropsWithoutRef<typeof MapboxNavigationControl>;
type MapLibreNavigationControlProps = ComponentPropsWithoutRef<typeof MapLibreNavigationControl>;

export type MapGLRenderer = EditorMapRenderer;
export type MapGLMapRef = MapboxMapRef | MapLibreMapRef;
export type MapGLLayerMouseEvent = MapboxLayerMouseEvent | MapLibreLayerMouseEvent;
export type MapGLMarkerEvent = MapboxMarkerEvent<MouseEvent> | MapLibreMarkerEvent<MouseEvent>;
export type MapGLLayerProps<T extends LayerSpecification["type"] = LayerSpecification["type"]> = {
  id?: LayerSpecification["id"];
  type: T;
  source?: LayerSpecification["source"];
  filter?: LayerSpecification["filter"];
  layout?: LayerSpecification["layout"];
  paint?: LayerSpecification["paint"];
  minzoom?: LayerSpecification["minzoom"];
  maxzoom?: LayerSpecification["maxzoom"];
  metadata?: LayerSpecification["metadata"];
  beforeId?: string;
};
export type MapGLMapProps = MapboxMapProps & MapLibreMapProps;
export type MapGLSourceProps = {
  id?: string;
  type: GeoJSONSourceSpecification["type"];
  data: NonNullable<GeoJSONSourceSpecification["data"]>;
  children?: ReactNode;
};
export type MapGLMarkerProps = MapboxMarkerProps & MapLibreMarkerProps;
export type MapGLNavigationControlProps = MapboxNavigationControlProps & MapLibreNavigationControlProps;

type MapGLProviderProps = {
  children: ReactNode;
  renderer: EditorMapRenderer;
};

export function MapGLProvider({ children, renderer }: MapGLProviderProps) {
  return <MapGLContext.Provider value={{ renderer }}>{children}</MapGLContext.Provider>;
}

function useMapGLRenderer() {
  const context = useContext(MapGLContext);

  if (!context) {
    throw new Error("MapGL components must be rendered inside MapGLProvider");
  }

  return context.renderer;
}

export const Map = forwardRef<MapGLMapRef, MapGLMapProps>(function Map(props, ref) {
  const renderer = useMapGLRenderer();

  if (renderer === "mapbox") {
    return (
      <MapboxMap
        ref={ref as ForwardedRef<MapboxMapRef>}
        {...props}
        mapboxAccessToken={getMapboxAccessToken()}
      />
    );
  }

  return <MapLibreMap ref={ref as ForwardedRef<MapLibreMapRef>} {...props} mapLib={maplibregl} />;
});

export function Layer<T extends LayerSpecification["type"]>(props: MapGLLayerProps<T>) {
  const renderer = useMapGLRenderer();

  if (renderer === "mapbox") {
    return <MapboxLayer {...(props as MapboxLayerProps)} />;
  }

  return <MapLibreLayer {...(props as MapLibreLayerProps)} />;
}

export function Source(props: MapGLSourceProps) {
  const renderer = useMapGLRenderer();

  if (renderer === "mapbox") {
    return <MapboxSource {...(props as MapboxGeoJSONSourceProps)} />;
  }

  return <MapLibreSource {...(props as MapLibreGeoJSONSourceProps)} />;
}

export function Marker(props: MapGLMarkerProps) {
  const renderer = useMapGLRenderer();
  const Component = (renderer === "mapbox" ? MapboxMarker : MapLibreMarker);

  return <Component {...props} />;
}

export function NavigationControl(props: MapGLNavigationControlProps) {
  const renderer = useMapGLRenderer();
  const Component =
    (renderer === "mapbox" ? MapboxNavigationControl : MapLibreNavigationControl);

  return <Component {...props} />;
}

export function useMap() {
  const renderer = useMapGLRenderer();

  return renderer === "mapbox" ? useMapbox() : useMaplibre();
}
