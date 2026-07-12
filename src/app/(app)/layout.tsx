import { RuntimeAppShell } from "@/components/app/runtime-app-shell";
import { requireStaff } from "@/lib/auth/server";

export default async function StaffAppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const displayName =
    staff.mode === "demo"
      ? "Gabbu (Demo Owner)"
      : staff.user.email?.split("@")[0] || "Signed-in staff";
  return (
    <RuntimeAppShell
      initialStaff={{
        displayName,
        role: staff.membership.role,
      }}
    >
      {children}
    </RuntimeAppShell>
  );
}
