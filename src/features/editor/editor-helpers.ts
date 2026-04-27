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

export type RouteAnnotation = {
  coordinate: LngLat;
  kind: "start" | "end" | "distance";
  label: string;
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

export function translateFeature(
  collection: DatasetFeatureCollection,
  featureId: string,
  delta: LngLat,
): DatasetFeatureCollection {
  const [deltaLng, deltaLat] = delta;

  if (deltaLng === 0 && deltaLat === 0) {
    return collection;
  }

  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId) {
        return feature;
      }

      if (feature.geometry.type === "Point") {
        const [lng, lat, elevation] = feature.geometry.coordinates as LngLat;
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates:
              typeof elevation === "number" && !Number.isNaN(elevation)
                ? [lng + deltaLng, lat + deltaLat, elevation]
                : [lng + deltaLng, lat + deltaLat],
          },
        };
      }

      if (feature.geometry.type === "LineString") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map((coordinate) =>
              offsetCoordinate(coordinate as LngLat, deltaLng, deltaLat),
            ) as Position[],
          },
        };
      }

      const ring = feature.geometry.coordinates[0] ?? [];

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: [
            ring.map((coordinate) => offsetCoordinate(coordinate as LngLat, deltaLng, deltaLat)) as Position[],
          ],
        },
      };
    }),
  };
}

/** Sets or clears the third coordinate (elevation in meters); lng/lat are preserved. */
export function withElevationMeters(coordinate: LngLat, elevationMeters: number | null): LngLat {
  if (elevationMeters === null || Number.isNaN(elevationMeters) || !Number.isFinite(elevationMeters)) {
    return [coordinate[0], coordinate[1]];
  }

  return [coordinate[0], coordinate[1], elevationMeters];
}

export function updateFeatureVertexElevation(
  collection: DatasetFeatureCollection,
  featureId: string,
  vertexIndex: number,
  elevationMeters: number | null,
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId) {
        return feature;
      }

      if (feature.geometry.type === "Point") {
        const current = feature.geometry.coordinates as LngLat;
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: withElevationMeters(current, elevationMeters),
          },
        };
      }

      if (feature.geometry.type === "LineString") {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: feature.geometry.coordinates.map((coordinate, index) =>
              index === vertexIndex
                ? withElevationMeters(coordinate as LngLat, elevationMeters)
                : coordinate,
            ) as Position[],
          },
        };
      }

      const ring = [...feature.geometry.coordinates[0]];
      ring[vertexIndex] = withElevationMeters(ring[vertexIndex] as LngLat, elevationMeters);
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

export function replaceLineFeatureCoordinates(
  collection: DatasetFeatureCollection,
  featureId: string,
  coordinates: LngLat[],
): DatasetFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      if (String(feature.id) !== featureId || feature.geometry.type !== "LineString") {
        return feature;
      }

      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates,
        },
      };
    }),
  };
}

export function reverseLineFeatureCoordinates(
  collection: DatasetFeatureCollection,
  featureId: string,
): DatasetFeatureCollection {
  const feature = collection.features.find((item) => String(item.id) === featureId);

  if (!feature || feature.geometry.type !== "LineString") {
    return collection;
  }

  return replaceLineFeatureCoordinates(collection, featureId, [...(feature.geometry.coordinates as LngLat[])].reverse());
}

export function simplifyLineCoordinatesByRdpRatio(
  coordinates: LngLat[],
  compressionRatio: number,
): LngLat[] {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  const isClosedLoop = coordinatesMatch(coordinates[0], coordinates[coordinates.length - 1]);
  const normalizedCoordinates = isClosedLoop ? coordinates.slice(0, -1) : [...coordinates];
  const minimumPointCount = isClosedLoop ? 3 : 2;
  const clampedRatio = Math.max(0, Math.min(0.95, compressionRatio));
  const targetPointCount = Math.max(
    minimumPointCount,
    Math.round(normalizedCoordinates.length * (1 - clampedRatio)),
  );

  if (targetPointCount >= normalizedCoordinates.length) {
    return coordinates;
  }

  const [minLongitude, maxLongitude, minLatitude, maxLatitude] = normalizedCoordinates.reduce(
    (bounds, coordinate) => [
      Math.min(bounds[0], coordinate[0]),
      Math.max(bounds[1], coordinate[0]),
      Math.min(bounds[2], coordinate[1]),
      Math.max(bounds[3], coordinate[1]),
    ],
    [Infinity, -Infinity, Infinity, -Infinity],
  );
  const maxTolerance = Math.hypot(maxLongitude - minLongitude, maxLatitude - minLatitude);

  let low = 0;
  let high = maxTolerance;
  let bestCoordinates = normalizedCoordinates;
  let bestDistanceToTarget = Math.abs(normalizedCoordinates.length - targetPointCount);

  for (let index = 0; index < 24; index += 1) {
    const tolerance = (low + high) / 2;
    const simplifiedCoordinates = simplifyLineCoordinatesRdp(normalizedCoordinates, tolerance);
    const distanceToTarget = Math.abs(simplifiedCoordinates.length - targetPointCount);

    if (
      distanceToTarget < bestDistanceToTarget ||
      (distanceToTarget === bestDistanceToTarget &&
        simplifiedCoordinates.length >= targetPointCount &&
        simplifiedCoordinates.length < bestCoordinates.length)
    ) {
      bestCoordinates = simplifiedCoordinates;
      bestDistanceToTarget = distanceToTarget;
    }

    if (simplifiedCoordinates.length > targetPointCount) {
      low = tolerance;
    } else {
      high = tolerance;
    }
  }

  const finalCoordinates = bestCoordinates.length >= minimumPointCount
    ? bestCoordinates
    : normalizedCoordinates.slice(0, minimumPointCount);

  return isClosedLoop ? [...finalCoordinates, finalCoordinates[0]] : finalCoordinates;
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

function simplifyLineCoordinatesRdp(coordinates: LngLat[], tolerance: number): LngLat[] {
  if (coordinates.length <= 2 || tolerance <= 0) {
    return [...coordinates];
  }

  const includedIndexes = new Set<number>([0, coordinates.length - 1]);
  const stack: Array<[number, number]> = [[0, coordinates.length - 1]];

  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop() ?? [0, 0];
    let maxDistance = 0;
    let maxDistanceIndex = -1;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = getPerpendicularDistance(
        coordinates[index],
        coordinates[startIndex],
        coordinates[endIndex],
      );

      if (distance > maxDistance) {
        maxDistance = distance;
        maxDistanceIndex = index;
      }
    }

    if (maxDistanceIndex !== -1 && maxDistance > tolerance) {
      includedIndexes.add(maxDistanceIndex);
      stack.push([startIndex, maxDistanceIndex], [maxDistanceIndex, endIndex]);
    }
  }

  return coordinates.filter((_, index) => includedIndexes.has(index));
}

function getPerpendicularDistance(point: LngLat, lineStart: LngLat, lineEnd: LngLat) {
  const [pointX, pointY] = point;
  const [startX, startY] = lineStart;
  const [endX, endY] = lineEnd;
  const deltaX = endX - startX;
  const deltaY = endY - startY;

  if (deltaX === 0 && deltaY === 0) {
    return Math.hypot(pointX - startX, pointY - startY);
  }

  const projection = ((pointX - startX) * deltaX + (pointY - startY) * deltaY) / (deltaX ** 2 + deltaY ** 2);
  const projectedX = startX + projection * deltaX;
  const projectedY = startY + projection * deltaY;

  return Math.hypot(pointX - projectedX, pointY - projectedY);
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

export function getLineCoordinateAtDistance(coordinates: LngLat[], distanceInKilometers: number): LngLat | null {
  if (coordinates.length === 0) {
    return null;
  }

  if (distanceInKilometers <= 0) {
    return coordinates[0];
  }

  let traversedDistance = 0;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = coordinates[index];
    const end = coordinates[index + 1];
    const segmentDistance = getLineLength([start, end]);

    if (segmentDistance <= 0) {
      continue;
    }

    if (traversedDistance + segmentDistance >= distanceInKilometers) {
      const progress = (distanceInKilometers - traversedDistance) / segmentDistance;
      const longitude = start[0] + (end[0] - start[0]) * progress;
      const latitude = start[1] + (end[1] - start[1]) * progress;
      const startElevation = getCoordinateElevation(start);
      const endElevation = getCoordinateElevation(end);

      if (startElevation !== null && endElevation !== null) {
        return [longitude, latitude, startElevation + (endElevation - startElevation) * progress];
      }

      return [longitude, latitude];
    }

    traversedDistance += segmentDistance;
  }

  return coordinates[coordinates.length - 1];
}

export function getLineRouteAnnotations(coordinates: LngLat[]): RouteAnnotation[] {
  if (coordinates.length < 2) {
    return [];
  }

  const totalDistance = getLineLength(coordinates);
  const annotations: RouteAnnotation[] = [
    {
      coordinate: coordinates[0],
      kind: "start",
      label: "start",
    },
  ];

  for (let kilometer = 1; kilometer < totalDistance; kilometer += 1) {
    const coordinate = getLineCoordinateAtDistance(coordinates, kilometer);

    if (!coordinate) {
      continue;
    }

    annotations.push({
      coordinate,
      kind: "distance",
      label: `${kilometer} km`,
    });
  }

  annotations.push({
    coordinate: coordinates[coordinates.length - 1],
    kind: "end",
    label: "finish",
  });

  return annotations;
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

function offsetCoordinate(coordinate: LngLat, deltaLng: number, deltaLat: number): LngLat {
  if (typeof coordinate[2] === "number" && !Number.isNaN(coordinate[2])) {
    return [coordinate[0] + deltaLng, coordinate[1] + deltaLat, coordinate[2]];
  }

  return [coordinate[0] + deltaLng, coordinate[1] + deltaLat];
}
