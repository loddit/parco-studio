import type { Feature } from "geojson";
import type { DatasetGeometry, LngLat } from "@/types/dataset";
import { createFeatureId } from "./editor-helpers";

function decodeCoordinateValue(
  encoded: string,
  cursor: number,
): { nextCursor: number; value: number } {
  let result = 0;
  let shift = 0;
  let currentCursor = cursor;

  while (currentCursor < encoded.length) {
    const byte = encoded.charCodeAt(currentCursor) - 63;
    currentCursor += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;

    if (byte < 0x20) {
      const value = (result & 1) === 1 ? ~(result >> 1) : result >> 1;
      return { nextCursor: currentCursor, value };
    }
  }

  throw new Error("Invalid encoded polyline.");
}

export function parseEncodedPolyline(
  encoded: string,
  precision: 5 | 6 = 5,
): Array<Feature<DatasetGeometry>> {
  const trimmedEncoded = encoded.trim();

  if (!trimmedEncoded) {
    throw new Error("Empty polyline.");
  }

  const scale = 10 ** precision;
  const coordinates: LngLat[] = [];
  let cursor = 0;
  let latitude = 0;
  let longitude = 0;

  while (cursor < trimmedEncoded.length) {
    const latChunk = decodeCoordinateValue(trimmedEncoded, cursor);
    cursor = latChunk.nextCursor;
    latitude += latChunk.value;

    const lngChunk = decodeCoordinateValue(trimmedEncoded, cursor);
    cursor = lngChunk.nextCursor;
    longitude += lngChunk.value;

    coordinates.push([longitude / scale, latitude / scale]);
  }

  if (coordinates.length < 2) {
    throw new Error("Polyline must contain at least two coordinates.");
  }

  return [
    {
      type: "Feature",
      id: createFeatureId(),
      properties: {},
      geometry: {
        type: "LineString",
        coordinates,
      },
    },
  ];
}
