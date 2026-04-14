import { IconLoader, IconSearch } from "@tabler/icons-react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import type { LngLat, LngLatBounds } from "@/types/dataset";

type GoogleGeocodingBarProps = {
  onLocationSelect: (location: { center: LngLat; bounds?: LngLatBounds }) => void;
};

type GeocodeStatus = "idle" | "loading" | "error";

export function GoogleGeocodingBar({ onLocationSelect }: GoogleGeocodingBarProps) {
  const geocodingLib = useMapsLibrary("geocoding");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<GeocodeStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);

  const trimmedQuery = query.trim();
  const isReady = geocodingLib !== null && geocoder !== null;
  const canSubmit = Boolean(isReady && trimmedQuery && status !== "loading");

  useEffect(() => {
    if (!geocodingLib) {
      setGeocoder(null);
      return;
    }

    setGeocoder(new geocodingLib.Geocoder());
  }, [geocodingLib]);

  const helperText = useMemo(() => {
    if (!geocodingLib) {
      return "Loading Google geocoding...";
    }

    if (status === "loading") {
      return "Searching...";
    }

    if (status === "error") {
      return statusMessage ?? "No matching locations found.";
    }

    return null;
  }, [geocodingLib, status, statusMessage]);

  async function searchLocation() {
    if (!canSubmit || !geocoder) {
      return;
    }

    setStatus("loading");
    setStatusMessage(null);

    try {
      const { results } = await geocoder.geocode({ address: trimmedQuery });
      const result = results[0];

      if (!result) {
        setStatus("error");
        setStatusMessage("No matching locations found.");
        return;
      }

      const center: LngLat = [result.geometry.location.lng(), result.geometry.location.lat()];
      const viewport = result.geometry.viewport;
      const bounds = viewport
        ? ([[viewport.getSouthWest().lng(), viewport.getSouthWest().lat()], [
            viewport.getNorthEast().lng(),
            viewport.getNorthEast().lat(),
          ]] as LngLatBounds)
        : undefined;

      onLocationSelect({ center, bounds });
      setStatus("idle");
      setStatusMessage(null);
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Search failed.");
    }
  }

  return (
    <div className="flex max-w-[300px] flex-col gap-1">
      <form
        className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-0 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          void searchLocation();
        }}
      >
        <input
          className="flex-1 py-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          disabled={!isReady}
          onChange={(event) => {
            setQuery(event.target.value);
            if (status !== "idle") {
              setStatus("idle");
              setStatusMessage(null);
            }
          }}
          placeholder="Search Google Maps"
          spellCheck={false}
          type="search"
          value={query}
        />
        <Button aria-label="Search location" disabled={!canSubmit} type="submit" variant="ghost">
          {status === "loading" ? (
            <IconLoader className="animate-spin" size={16} stroke={1.5} />
          ) : (
            <IconSearch size={16} stroke={1.5} />
          )}
        </Button>
      </form>
      {helperText ? <p className="text-[11px] text-slate-500">{helperText}</p> : null}
    </div>
  );
}
