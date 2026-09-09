"use client";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { DokumentasiView } from "./DokumentasiView";

export default function DokumentasiPage() {
  return (
    <RequireAuth>
      <DokumentasiView />
    </RequireAuth>
  );
}
