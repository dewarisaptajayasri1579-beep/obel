"use client";

import { useEffect } from "react";
import { ServerCrash } from "lucide-react";
import { ErrorState, Button } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      icon={ServerCrash}
      code="500"
      title="Terjadi Kesalahan"
      description="Ada masalah di server kami. Silakan coba lagi — kalau masih terjadi, hubungi admin."
      action={
        <Button variant="primary" fullWidth onClick={() => reset()}>
          Coba Lagi
        </Button>
      }
    />
  );
}
