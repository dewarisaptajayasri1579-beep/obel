import Link from "next/link";
import { SearchX } from "lucide-react";
import { ErrorState, Button } from "@/components/ui";

export default function NotFound() {
  return (
    <ErrorState
      icon={SearchX}
      code="404"
      title="Halaman Tidak Ditemukan"
      description="URL yang Anda tuju tidak tersedia atau sudah dipindahkan."
      action={
        <Link href="/dashboard">
          <Button variant="primary" fullWidth>
            Kembali ke Dashboard
          </Button>
        </Link>
      }
    />
  );
}
