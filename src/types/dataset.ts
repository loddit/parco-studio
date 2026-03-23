export type LngLat = [number, number];

export type Dataset = {
  id: string;
  name: string;
  center: LngLat | null;
  zoomLevel: number | null;
  createdAt: string;
  updatedAt: string;
};
