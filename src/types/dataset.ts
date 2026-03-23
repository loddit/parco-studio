import type { FeatureCollection, LineString, Point, Polygon } from "geojson";

export type LngLat = [number, number];
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
