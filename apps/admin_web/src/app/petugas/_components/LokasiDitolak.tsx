import { MapPinOff } from "lucide-react";
import { ApiError } from "@/lib/api-client";
import { OBBEL } from "../_lib/theme";

/// Penolakan absen karena di luar radius (OUTSIDE_ATTENDANCE_RADIUS, BR-042). Angka diambil dari
/// `details` respons backend (distance/radius/place), bukan diurai dari kalimat pesannya.
export interface PenolakanLokasi {
  pesan: string;
  jarak?: number;
  radius?: number;
  acuan?: string;
}

export function penolakanDariError(err: ApiError): PenolakanLokasi {
  const d = err.details ?? {};
  return {
    pesan: err.message,
    jarak: typeof d.distance === "number" ? d.distance : undefined,
    radius: typeof d.radius === "number" ? d.radius : undefined,
    acuan: typeof d.place === "string" ? d.place : undefined,
  };
}

function formatJarak(meter: number): string {
  return meter < 1000 ? `${meter} m` : `${(meter / 1000).toFixed(1).replace(".", ",")} km`;
}

/// Panel merah "Anda belum berada di area …" — dipakai semua layar absen (Berangkat, Tiba, Check-Out,
/// Kembali) supaya pesannya sama. Barista perlu tahu seberapa jauh, apa yang harus dilakukan, dan
/// bahwa Admin bisa memberi izin kalau GPS-nya yang meleset.
export function PanelLokasiDitolak({ penolakan, tempat }: { penolakan: PenolakanLokasi; tempat: "booth" | "gudang" }) {
  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex gap-3">
      <MapPinOff size={20} className="shrink-0 mt-0.5" style={{ color: OBBEL.accentRed }} />
      <div className="text-sm text-red-800 flex flex-col gap-2">
        <p className="font-bold text-base">Anda belum berada di area {tempat}</p>
        {penolakan.jarak != null && penolakan.radius != null ? (
          <p>
            Posisi Anda sekitar <strong>{formatJarak(penolakan.jarak)}</strong> dari {penolakan.acuan ?? tempat}. Absen hanya bisa dalam
            radius {formatJarak(penolakan.radius)}.
          </p>
        ) : (
          <p>{penolakan.pesan}</p>
        )}
        <ul className="list-disc pl-5 space-y-1 text-red-700">
          <li>Mendekatlah ke {tempat}, lalu tekan Perbarui lokasi.</li>
          <li>Sudah di lokasi tapi GPS meleset? Minta Admin memberi izin absen, lalu tekan tombol lagi.</li>
        </ul>
      </div>
    </div>
  );
}
