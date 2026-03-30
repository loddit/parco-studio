import turfLength from "@turf/length";
import type {
  Feature,
  FeatureCollection,
  GeoJSON,
  Geometry,
  GeometryCollection,
  LineString,
  Point,
  Polygon,
  Position,
} from "geojson";
import type { DatasetFeatureCollection, DatasetGeometry, LngLat, LngLatBounds } from "@/types/dataset";
import type { EditorMode } from "./editor-types";

type ClickedFeatureEvent = {
  features?: Array<{ properties?: Record<string, unknown> | null }>;
};

export type LinkableLineEndpoint = {
  coordinate: LngLat;
  featureId: string;
  vertexIndex: number;
};

export const FALLBACK_CENTER = { lat: 31.2304, lng: 121.4737 };
export const FALLBACK_ZOOM = 10;
export const HISTORY_LIMIT = 100;

export function createFeatureId() {
  return crypto.randomUUID();
}

export function createPointFeature(coordinate: LngLat): Feature<Point> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry: {
      type: "Point",
      coordinates: coordinate,
    },
  };
}

export function createLineFeature(coordinates: LngLat[]): Feature<LineString> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry: {
      type: "LineString",
      coordinates,
    },
  };
}

export function createPolygonFeature(coordinates: LngLat[]): Feature<Polygon> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[...coordinates, coordinates[0]]],
    },
  };
}

export function appendFeature(
  collection: DatasetFeatureCollection,
  feature: Feature<DatasetGeometry>,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: [...collection.features, feature],
  };
}

export function buildRenderableFeatures(
  collection: DatasetFeatureCollection,
  selectedFeatureId: string | null,
): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: collection.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        featureId: String(feature.id),
        isSelected: String(feature.id) === selectedFeatureId,
      },
    })),
  };
}

export function buildDraftFeatures(
  mode: EditorMode,
  coordinates: LngLat[],
  hoverCoordinate: LngLat | null,
): FeatureCollection {
  if (mode === "draw-point") {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  const draftFeatures: Feature[] = coordinates.map((coordinate, index) => ({
    type: "Feature",
    id: `draft-point-${index}`,
    properties: {},
    geometry: {
      type: "Point",
      coordinates: coordinate,
    },
  }));

  if (mode === "draw-line" && coordinates.length >= 1) {
    draftFeatures.push({
      type: "Feature",
      id: "draft-line",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: hoverCoordinate ? [...coordinates, hoverCoordinate] : coordinates,
      },
    });
  }

  if (mode === "draw-polygon" && coordinates.length >= 2) {
    const previewCoordinates = hoverCoordinate ? [...coordinates, hoverCoordinate] : coordinates;
    draftFeatures.push({
      type: "Feature",
      id: "draft-polygon",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[...previewCoordinates, previewCoordinates[0]]],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features: draftFeatures,
  };
}

export function getClickedFeatureId(event: ClickedFeatureEvent) {
  const clickedFeature = event.features?.find(
    (feature) => feature.properties && "featureId" in feature.properties,
  );

  if (!clickedFeature?.properties) {
    return null;
  }

  return String(clickedFeature.properties.featureId);
}

export function getFeatureVertices(feature: Feature<DatasetGeometry>): LngLat[] {
  if (feature.geometry.type === "Point") {
    return [feature.geometry.coordinates as LngLat];
  }

  if (feature.geometry.type === "LineString") {
    return feature.geometry.coordinates as LngLat[];
  }

  return (feature.geometry.coordinates[0]?.slice(0, -1) ?? []) as LngLat[];
}

export function getFeatureMidpoints(feature: Feature<DatasetGeometry>) {
  if (feature.geometry.type === "Point") {
    return [];
  }

  const vertices = getFeatureVertices(feature);

  if (feature.geometry.type === "LineString") {
    return vertices.slice(0, -1).map((coordinate, index) => ({
      coordinate: getMidpoint(coordinate, vertices[index + 1]),
      segmentIndex: index,
    }));
  }

  return vertices.map((coordinate, index) => ({
    coordinate: getMidpoint(coordinate, vertices[(index + 1) % vertices.length]),
    segmentIndex: index,
  }));
}

export function getLinkableLineEndpoints(collection: DatasetFeatureCollection): LinkableLineEndpoint[] {
  return collection.features.flatMap((feature) => {
    if (feature.geometry.type !== "LineString") {
      return [];
    }

    const coordinates = feature.geometry.coordinates as LngLat[];

    if (coordinates.length < 2) {
      return [];
    }

    return [
      {
        coordinate: coordinates[0],
        featureId: String(feature.id),
        vertexIndex: 0,
      },
      {
        coordinate: coordinates[coordinates.length - 1],
        featureId: String(feature.id),
        vertexIndex: coordinates.length - 1,
      },
    ];
  });
}

export function updateFeatureVertex(
  collection: DatasetFeatureCollection,
  featureId: string,
  vertexIndex: number,
  coordinate: LngLat,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId) {
        return feature;
      }

      if (feature.geometry.type === "Point") {
        const currentCoordinate = feature.geometry.coordinates as LngLat;
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: mergeCoordinateElevation(currentCoordinate, coordinate),
          },
        };
      }

      if (feature.geometry.type === "LineString") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map((current, index) =>
              index === vertexIndex
                ? mergeCoordinateElevation(current as LngLat, coordinate)
                : current,
            ) as Position[],
          },
        };
      }

      const ring = [...feature.geometry.coordinates[0]];
      ring[vertexIndex] = mergeCoordinateElevation(ring[vertexIndex] as LngLat, coordinate);
      ring[ring.length - 1] = ring[0];

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [ring],
        },
      };
    }),
  };
}

export function insertFeatureVertexAtMidpoint(
  collection: DatasetFeatureCollection,
  featureId: string,
  segmentIndex: number,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId || feature.geometry.type === "Point") {
        return feature;
      }

      if (feature.geometry.type === "LineString") {
        const coordinates = [...feature.geometry.coordinates];
        const nextCoordinate = getMidpoint(
          coordinates[segmentIndex] as LngLat,
          coordinates[segmentIndex + 1] as LngLat,
        );
        coordinates.splice(segmentIndex + 1, 0, nextCoordinate);

        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates,
          },
        };
      }

      const ring = [...feature.geometry.coordinates[0].slice(0, -1)];
      const nextCoordinate = getMidpoint(
        ring[segmentIndex] as LngLat,
        ring[(segmentIndex + 1) % ring.length] as LngLat,
      );
      ring.splice(segmentIndex + 1, 0, nextCoordinate);

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [[...ring, ring[0]]],
        },
      };
    }),
  };
}

export function removeFeatureVertex(
  collection: DatasetFeatureCollection,
  featureId: string,
  vertexIndex: number,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId || feature.geometry.type === "Point") {
        return feature;
      }

      if (feature.geometry.type === "LineString") {
        if (feature.geometry.coordinates.length <= 2) {
          return feature;
        }

        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.filter((_, index) => index !== vertexIndex),
          },
        };
      }

      const ring = feature.geometry.coordinates[0]?.slice(0, -1) ?? [];

      if (ring.length <= 3) {
        return feature;
      }

      const nextRing = ring.filter((_, index) => index !== vertexIndex);

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [[...nextRing, nextRing[0]]],
        },
      };
    }),
  };
}

export function splitLineFeatureAtVertex(
  collection: DatasetFeatureCollection,
  featureId: string,
  vertexIndex: number,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.flatMap((feature) => {
      if (String(feature.id) !== featureId || feature.geometry.type !== "LineString") {
        return [feature];
      }

      const coordinates = feature.geometry.coordinates as LngLat[];
      const isClosedLoop =
        coordinates.length >= 3 && coordinatesMatch(coordinates[0] as LngLat, coordinates[coordinates.length - 1] as LngLat);

      if (isClosedLoop && (vertexIndex === 0 || vertexIndex === coordinates.length - 1)) {
        return [
          ({
            ...feature,
            geometry: {
              type: "LineString",
              coordinates: coordinates.slice(0, -1),
            },
          } satisfies Feature<LineString>),
        ];
      }

      const firstSegment = coordinates.slice(0, vertexIndex + 1);
      const secondSegment = coordinates.slice(vertexIndex + 1);

      if (firstSegment.length < 2 || secondSegment.length < 2) {
        return [feature];
      }

      return [
        ({
          ...feature,
          id: createFeatureId(),
          geometry: {
            type: "LineString",
            coordinates: firstSegment,
          },
        } satisfies Feature<LineString>),
        ({
          ...feature,
          id: createFeatureId(),
          geometry: {
            type: "LineString",
            coordinates: secondSegment,
          },
        } satisfies Feature<LineString>),
      ];
    }),
  };
}

export function linkLineFeaturesAtEndpoints(
  collection: DatasetFeatureCollection,
  sourceFeatureId: string,
  sourceVertexIndex: number,
  targetFeatureId: string,
  targetVertexIndex: number,
): DatasetFeatureCollection {
  const sourceFeature = collection.features.find((feature) => String(feature.id) === sourceFeatureId);
  const targetFeature = collection.features.find((feature) => String(feature.id) === targetFeatureId);

  if (!sourceFeature || !targetFeature) {
    return collection;
  }

  if (sourceFeature.geometry.type !== "LineString" || targetFeature.geometry.type !== "LineString") {
    return collection;
  }

  const sourceCoordinates = sourceFeature.geometry.coordinates as LngLat[];
  const targetCoordinates = targetFeature.geometry.coordinates as LngLat[];

  if (!isLineEndpointIndex(sourceCoordinates, sourceVertexIndex) || !isLineEndpointIndex(targetCoordinates, targetVertexIndex)) {
    return collection;
  }

  if (sourceFeatureId === targetFeatureId) {
    if (coordinatesMatch(sourceCoordinates[0], sourceCoordinates[sourceCoordinates.length - 1])) {
      return collection;
    }

    return {
      ...collection,
      features: collection.features.map((feature) =>
        String(feature.id) !== sourceFeatureId
          ? feature
          : ({
              ...feature,
              geometry: {
                type: "LineString",
                coordinates: [...sourceCoordinates, sourceCoordinates[0]],
              },
            } satisfies Feature<LineString>),
      ),
    };
  }

  const orientedSourceCoordinates =
    sourceVertexIndex === sourceCoordinates.length - 1 ? sourceCoordinates : [...sourceCoordinates].reverse();
  const orientedTargetCoordinates =
    targetVertexIndex === 0 ? targetCoordinates : [...targetCoordinates].reverse();

  const mergedCoordinates = coordinatesMatch(
    orientedSourceCoordinates[orientedSourceCoordinates.length - 1],
    orientedTargetCoordinates[0],
  )
    ? [...orientedSourceCoordinates, ...orientedTargetCoordinates.slice(1)]
    : [...orientedSourceCoordinates, ...orientedTargetCoordinates];

  return {
    ...collection,
    features: collection.features.flatMap((feature) => {
      if (String(feature.id) === targetFeatureId) {
        return [];
      }

      if (String(feature.id) !== sourceFeatureId) {
        return [feature];
      }

      return [
        ({
          ...feature,
          geometry: {
            type: "LineString",
            coordinates: mergedCoordinates,
          },
        } satisfies Feature<LineString>),
      ];
    }),
  };
}

export function extractSupportedFeatures(geojson: GeoJSON): Array<Feature<DatasetGeometry>> {
  if (geojson.type === "FeatureCollection") {
    return geojson.features.flatMap((feature) => extractFeature(feature));
  }

  if (geojson.type === "Feature") {
    return extractFeature(geojson);
  }

  if (isSupportedGeometry(geojson)) {
    return [createImportedFeature(geojson)];
  }

  if (geojson.type === "GeometryCollection") {
    return extractGeometryCollection(geojson);
  }

  return [];
}

function isLineEndpointIndex(coordinates: LngLat[], vertexIndex: number) {
  return vertexIndex === 0 || vertexIndex === coordinates.length - 1;
}

function coordinatesMatch(left: LngLat, right: LngLat) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function extractFeature(feature: Feature): Array<Feature<DatasetGeometry>> {
  if (!feature.geometry) {
    return [];
  }

  if (isSupportedGeometry(feature.geometry)) {
    return [
      {
        ...feature,
        id: createFeatureId(),
        geometry: feature.geometry,
        properties: feature.properties ?? {},
      },
    ];
  }

  if (feature.geometry.type === "GeometryCollection") {
    return extractGeometryCollection(feature.geometry).map((geometryFeature) => ({
      ...geometryFeature,
      properties: feature.properties ?? {},
    }));
  }

  return [];
}

function extractGeometryCollection(geometry: GeometryCollection): Array<Feature<DatasetGeometry>> {
  return geometry.geometries
    .filter(isSupportedGeometry)
    .map((supportedGeometry) => createImportedFeature(supportedGeometry));
}

function isSupportedGeometry(geometry: Geometry): geometry is DatasetGeometry {
  return (
    geometry.type === "Point" ||
    geometry.type === "LineString" ||
    geometry.type === "Polygon"
  );
}

function createImportedFeature(geometry: DatasetGeometry): Feature<DatasetGeometry> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: {},
    geometry,
  };
}

export function cloneFeatureCollection(
  collection: DatasetFeatureCollection,
): DatasetFeatureCollection {
  return structuredClone(collection);
}

export function getFeatureBounds(features: Array<Feature<DatasetGeometry>>): LngLatBounds | null {
  const coordinates = features.flatMap((feature) => getGeometryCoordinates(feature.geometry));

  if (coordinates.length === 0) {
    return null;
  }

  let minLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLng = coordinates[0][0];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

function getGeometryCoordinates(geometry: DatasetGeometry): LngLat[] {
  if (geometry.type === "Point") {
    return [geometry.coordinates as LngLat];
  }

  if (geometry.type === "LineString") {
    return geometry.coordinates as LngLat[];
  }

  return (geometry.coordinates[0] ?? []) as LngLat[];
}

export function getMidpoint(start: LngLat, end: LngLat): LngLat {
  const longitude = (start[0] + end[0]) / 2;
  const latitude = (start[1] + end[1]) / 2;
  const startElevation = getCoordinateElevation(start);
  const endElevation = getCoordinateElevation(end);

  if (startElevation !== null && endElevation !== null) {
    return [longitude, latitude, (startElevation + endElevation) / 2];
  }

  return [longitude, latitude];
}

export function formatLineLength(lengthInKilometers: number) {
  if (lengthInKilometers < 1) {
    return `${Math.round(lengthInKilometers * 1000)} m`;
  }

  return `${lengthInKilometers.toFixed(2)} km`;
}

export function formatArea(areaInSquareMeters: number) {
  if (areaInSquareMeters < 1_000_000) {
    return `${Math.round(areaInSquareMeters)} m²`;
  }

  return `${(areaInSquareMeters / 1_000_000).toFixed(2)} km²`;
}

export function getLineLength(coordinates: LngLat[]) {
  if (coordinates.length < 2) {
    return 0;
  }

  return turfLength(
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    },
    { units: "kilometers" },
  );
}

export function getPolygonArea(coordinates: LngLat[]) {
  if (coordinates.length < 3) {
    return 0;
  }

  const ring = [...coordinates, coordinates[0]];
  const earthRadiusInMeters = 6_378_137;
  let sum = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [startLongitude, startLatitude] = ring[index];
    const [endLongitude, endLatitude] = ring[index + 1];
    const startX = earthRadiusInMeters * ((startLongitude * Math.PI) / 180);
    const endX = earthRadiusInMeters * ((endLongitude * Math.PI) / 180);
    const startY =
      earthRadiusInMeters *
      Math.log(Math.tan(Math.PI / 4 + (((Math.max(-85, Math.min(85, startLatitude)) * Math.PI) / 180) / 2)));
    const endY =
      earthRadiusInMeters *
      Math.log(Math.tan(Math.PI / 4 + (((Math.max(-85, Math.min(85, endLatitude)) * Math.PI) / 180) / 2)));

    sum += startX * endY - endX * startY;
  }

  return Math.abs(sum) / 2;
}

export function getLineDistanceToVertex(feature: Feature<LineString>, vertexIndex: number) {
  if (vertexIndex <= 0) {
    return 0;
  }

  return turfLength(
    {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.slice(0, vertexIndex + 1),
      },
    },
    { units: "kilometers" },
  );
}

export function getModeDescription(mode: EditorMode, draftCount: number) {
  if (mode === "select") {
    return "Select features, drag vertices, and delete with Backspace or Delete.";
  }

  if (mode === "draw-point") {
    return "Click once to place a point.";
  }

  if (mode === "draw-line") {
    return draftCount > 0
      ? "Continue clicking to add vertices. Press Enter or double-click to finish."
      : "Click to start a line.";
  }

  return draftCount > 0
    ? "Continue clicking to shape the polygon. Press Enter or double-click to finish."
    : "Click to start a polygon.";
}

export function getMapCursor(
  mode: EditorMode,
  isDraggingVertex: boolean,
  isHoveringSelectableFeature: boolean,
) {
  if (isDraggingVertex) {
    return "grabbing";
  }

  if (mode === "select" && isHoveringSelectableFeature) {
    return "pointer";
  }

  return mode === "select" ? "grab" : "crosshair";
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function getCoordinateElevation(coordinate: LngLat | null | undefined) {
  if (!coordinate || typeof coordinate[2] !== "number" || Number.isNaN(coordinate[2])) {
    return null;
  }

  return coordinate[2];
}

export function formatCoordinateElevation(coordinate: LngLat | null | undefined) {
  const elevation = getCoordinateElevation(coordinate);

  if (elevation === null) {
    return "unknown";
  }

  return `${Number(elevation.toFixed(2))} m`;
}

function mergeCoordinateElevation(current: LngLat, next: LngLat): LngLat {
  if (typeof next[2] === "number" && !Number.isNaN(next[2])) {
    return next;
  }

  if (typeof current[2] === "number" && !Number.isNaN(current[2])) {
    return [next[0], next[1], current[2]];
  }

  return [next[0], next[1]];
}
