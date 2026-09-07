/// Field Profile yang aman untuk diikutsertakan di response API — TIDAK
/// PERNAH pakai `relationName: true` untuk relasi ke Profile, karena itu
/// membocorkan passwordHash. Selalu `relationName: { select: SAFE_PROFILE_SELECT }`.
export const SAFE_PROFILE_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  defaultBoothId: true,
  active: true,
} as const;
