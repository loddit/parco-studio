import type { FeatureCollection, LineString, Point, Polygon } from "geojson";

export type LngLat2D = [number, number];
export type LngLat = LngLat2D | [number, number, number];
export type LngLatBounds = [LngLat2D, LngLat2D];
export type DatasetGeometry = Point | LineString | Polygon;
export type DatasetFeatureCollection = FeatureCollection<DatasetGeometry>;

export function createEmptyFeatureCollection(): DatasetFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}

export type Dataset = {
  id: string;
  name: string;
  center: LngLat | null;
  zoomLevel: number | null;
  features: DatasetFeatureCollection;
  createdAt: string;
  updatedAt: string;
};
