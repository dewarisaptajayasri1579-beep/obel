import type { UserAccount } from "@/lib/api-client";

export interface PetugasFormValues {
  id: string;
  username: string;
  password: string;
  fullName: string;
  defaultBoothId: string;
  isActive: boolean;
}

export function nilaiAwalPetugas(): PetugasFormValues {
  return { id: "", username: "", password: "", fullName: "", defaultBoothId: "", isActive: true };
}

export function keFormValues(u: UserAccount): PetugasFormValues {
  return {
    id: u.id,
    username: u.username,
    password: "",
    fullName: u.fullName,
    defaultBoothId: u.defaultBoothId ?? "",
    isActive: u.active,
  };
}
