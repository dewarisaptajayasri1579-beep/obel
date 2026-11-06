"use client";

import { Suspense } from "react";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { Spinner } from "@/components/ui";
import { PanduanView } from "./PanduanView";

export default function PanduanPage() {
  return (
    <RequireAuth>
      {/* useSearchParams wajib dibungkus Suspense di App Router. */}
      <Suspense fallback={<Spinner />}>
        <PanduanView />
      </Suspense>
    </RequireAuth>
  );
}
