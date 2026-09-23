import type { Booth } from "@/lib/api-client";

export interface BoothFormValues {
  id: string;
  code: string;
  name: string;
  locationName: string;
  address: string;
  latitude: string;
  longitude: string;
  qrisImageUrl: string;
  isActive: boolean;
}

export function nilaiAwalBooth(): BoothFormValues {
  return {
    id: "",
    code: "",
    name: "",
    locationName: "",
    address: "",
    latitude: "",
    longitude: "",
    qrisImageUrl: "",
    isActive: true,
  };
}

export function keFormValues(b: Booth): BoothFormValues {
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    locationName: b.locationName ?? "",
    address: b.address ?? "",
    latitude: b.latitude === null ? "" : String(b.latitude),
    longitude: b.longitude === null ? "" : String(b.longitude),
    qrisImageUrl: b.qrisImageUrl ?? "",
    isActive: b.status === "ACTIVE",
  };
}
