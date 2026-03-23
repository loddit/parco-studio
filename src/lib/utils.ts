export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatCenter(center: [number, number] | null) {
  if (!center) {
    return "Not captured yet";
  }

  return `${center[1].toFixed(5)}, ${center[0].toFixed(5)}`;
}

export function formatZoomLevel(zoomLevel: number | null) {
  if (zoomLevel == null) {
    return "Not captured yet";
  }

  return zoomLevel.toFixed(2);
}
