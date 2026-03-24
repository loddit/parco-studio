import type { Feature } from "geojson";
import type { DatasetGeometry, LngLat } from "@/types/dataset";
import { createFeatureId } from "./editor-helpers";

function parseCoordinateElement(element: Element) {
  const lng = Number(element.getAttribute("lon"));
  const lat = Number(element.getAttribute("lat"));

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  const elevationElement = element.querySelector(":scope > ele");
  const elevation = elevationElement ? Number(elevationElement.textContent) : null;

  if (elevation !== null && Number.isFinite(elevation)) {
    return [lng, lat, elevation] as LngLat;
  }

  return [lng, lat] as LngLat;
}

function createFeature(geometry: DatasetGeometry, name?: string | null): Feature<DatasetGeometry> {
  return {
    type: "Feature",
    id: createFeatureId(),
    properties: name ? { name } : {},
    geometry,
  };
}

export function parseGpx(text: string): Array<Feature<DatasetGeometry>> {
  const document = new DOMParser().parseFromString(text, "application/xml");

  if (document.querySelector("parsererror")) {
    throw new Error("Invalid GPX");
  }

  const waypointFeatures = Array.from(document.querySelectorAll("wpt"))
    .map((waypoint) => {
      const coordinate = parseCoordinateElement(waypoint);

      if (!coordinate) {
        return null;
      }

      const name = waypoint.querySelector(":scope > name")?.textContent?.trim();
      return createFeature(
        {
          type: "Point",
          coordinates: coordinate,
        },
        name,
      );
    })
    .filter((feature): feature is Feature<DatasetGeometry> => feature !== null);

  const routeFeatures = Array.from(document.querySelectorAll("rte"))
    .map((route) => {
      const coordinates = Array.from(route.querySelectorAll(":scope > rtept"))
        .map((routePoint) => parseCoordinateElement(routePoint))
        .filter((coordinate): coordinate is LngLat => coordinate !== null);

      if (coordinates.length < 2) {
        return null;
      }

      const name = route.querySelector(":scope > name")?.textContent?.trim();
      return createFeature(
        {
          type: "LineString",
          coordinates,
        },
        name,
      );
    })
    .filter((feature): feature is Feature<DatasetGeometry> => feature !== null);

  const trackFeatures = Array.from(document.querySelectorAll("trk"))
    .flatMap((track) =>
      Array.from(track.querySelectorAll(":scope > trkseg"))
        .map((segment, segmentIndex) => {
          const coordinates = Array.from(segment.querySelectorAll(":scope > trkpt"))
            .map((trackPoint) => parseCoordinateElement(trackPoint))
            .filter((coordinate): coordinate is LngLat => coordinate !== null);

          if (coordinates.length < 2) {
            return null;
          }

          const trackName = track.querySelector(":scope > name")?.textContent?.trim();
          const name =
            trackName && track.querySelectorAll(":scope > trkseg").length > 1
              ? `${trackName} ${segmentIndex + 1}`
              : trackName;

          return createFeature(
            {
              type: "LineString",
              coordinates,
            },
            name,
          );
        })
        .filter((feature): feature is Feature<DatasetGeometry> => feature !== null),
    );

  return [...waypointFeatures, ...routeFeatures, ...trackFeatures];
}

function appendTextNode(xmlDocument: XMLDocument, parent: Element, tagName: string, value: string) {
  const node = xmlDocument.createElement(tagName);
  node.textContent = value;
  parent.appendChild(node);
}

export function exportLineStringToGpx(feature: Feature<DatasetGeometry>, filename: string) {
  if (feature.geometry.type !== "LineString") {
    throw new Error("Only LineString features can be exported as GPX.");
  }

  const xmlDocument = window.document.implementation.createDocument("", "gpx", null);
  const root = xmlDocument.documentElement;

  root.setAttribute("version", "1.1");
  root.setAttribute("creator", "Parco Studio");
  root.setAttribute("xmlns", "http://www.topografix.com/GPX/1/1");

  const track = xmlDocument.createElement("trk");
  appendTextNode(xmlDocument, track, "name", filename);

  const segment = xmlDocument.createElement("trkseg");

  for (const coordinate of feature.geometry.coordinates as LngLat[]) {
    const trackPoint = xmlDocument.createElement("trkpt");
    trackPoint.setAttribute("lon", String(coordinate[0]));
    trackPoint.setAttribute("lat", String(coordinate[1]));

    if (typeof coordinate[2] === "number" && !Number.isNaN(coordinate[2])) {
      appendTextNode(xmlDocument, trackPoint, "ele", String(coordinate[2]));
    }

    segment.appendChild(trackPoint);
  }

  track.appendChild(segment);
  root.appendChild(track);

  return new XMLSerializer().serializeToString(xmlDocument);
}
