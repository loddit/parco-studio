import { IconLoader, IconSearch } from "@tabler/icons-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import type { LngLat, LngLatBounds } from "@/types/dataset";

type GeocodingBarProps = {
  googleMapsApiKey?: string;
  onLocationSelect: (location: { center: LngLat; bounds?: LngLatBounds }) => void;
};

type GeocodeStatus = "idle" | "loading" | "error";

type GoogleGeocodeResponse = {
  results: Array<{
    geometry: {
      location: { lat: number; lng: number };
      viewport?: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
      };
    };
  }>;
  status: string;
  error_message?: string;
};

export function GeocodingBar({ googleMapsApiKey, onLocationSelect }: GeocodingBarProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<GeocodeStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const isGoogleMapsEnabled = Boolean(googleMapsApiKey?.trim());
  const canSubmit = Boolean(isGoogleMapsEnabled && trimmedQuery && status !== "loading");

  const helperText = useMemo(() => {
    if (!isGoogleMapsEnabled) {
      return "Add VITE_GOOGLE_MAPS_API_KEY to search locations.";
    }

    if (status === "loading") {
      return "Searching...";
    }

    if (status === "error") {
      return statusMessage ?? "No matching locations found.";
    }

    return null;
  }, [isGoogleMapsEnabled, status, statusMessage]);

  const searchLocation = useCallback(async () => {
    if (!canSubmit || !googleMapsApiKey) {
      return;
    }

    setStatus("loading");
    setStatusMessage(null);

    const params = new URLSearchParams({
      address: trimmedQuery,
      key: googleMapsApiKey,
    });

    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);

      if (!response.ok) {
        throw new Error("Unable to reach Google Maps.");
      }

      const data = (await response.json()) as GoogleGeocodeResponse;

      if (data.status !== "OK" || data.results.length === 0) {
        setStatus("error");
        setStatusMessage(data.error_message ?? "No matching locations found.");
        return;
      }

      const { geometry } = data.results[0];
      const center: LngLat = [geometry.location.lng, geometry.location.lat];
      const bounds = geometry.viewport
        ? (
            [
              [geometry.viewport.southwest.lng, geometry.viewport.southwest.lat],
              [geometry.viewport.northeast.lng, geometry.viewport.northeast.lat],
            ] as LngLatBounds
          )
        : undefined;

      onLocationSelect({ center, bounds });
      setStatus("idle");
      setStatusMessage(null);
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Search failed.");
    }
  }, [canSubmit, googleMapsApiKey, onLocationSelect, trimmedQuery]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void searchLocation();
  };

  return (
    <div className="flex max-w-[300px] flex-col gap-1">
      <form className="flex items-center gap-2 rounded-lg border-2 border-slate-200 bg-white px-3 py-0 shadow-sm" onSubmit={handleSubmit}>
        <input
          className="flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
          disabled={!isGoogleMapsEnabled}
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
        <Button
          aria-label="Search location"
          disabled={!canSubmit}
          type="submit"
          variant="ghost"
        >
          {status === "loading" ? (
            <IconLoader className="animate-spin" size={16} stroke={1.5} />
          ) : (
            <IconSearch size={16} stroke={1.5} />
          )}
        </Button>
      </form>
      {helperText ? (
        <p className="text-[11px] text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}
