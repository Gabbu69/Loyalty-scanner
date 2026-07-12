export type StaffRole = "owner" | "staff";

export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
};

export type StaffMembership = {
  id: string;
  storeId: string;
  userId: string;
  role: StaffRole;
  isActive: boolean;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
};

export type StaffIdentity = {
  mode: "demo" | "supabase";
  user: AuthUser;
  membership: StaffMembership;
  isOwner: boolean;
};

export type AuthState =
  | { status: "authenticated"; staff: StaffIdentity }
  | { status: "unauthenticated"; reason: "missing_session" | "invalid_session" }
  | { status: "unregistered"; user: AuthUser }
  | { status: "inactive"; user: AuthUser; membership: StaffMembership }
  | { status: "unavailable"; reason: string };

export const PROTECTED_ROUTE_PREFIXES = [
  "/scan",
  "/customers",
  "/activity",
  "/dashboard",
  "/settings",
  "/staff",
] as const;

export function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
