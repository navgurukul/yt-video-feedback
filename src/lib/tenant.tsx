/**
 * Who the signed-in user is on our backend: active institution, role, and
 * the institutions they can switch between. Filled by AuthGate from /api/me.
 */
import { createContext, useContext } from "react";

export type Role = "student" | "evaluator" | "institution_admin" | "super_admin";

export interface MeResponse {
  email: string;
  isSuperAdmin: boolean;
  role: Role;
  memberships: { institutionId: string; name: string; slug: string; logoUrl: string | null; roles: Role[] }[];
  activeInstitution: { id: string; name: string; slug: string; logoUrl: string | null } | null;
}

const RANK: Record<Role, number> = { student: 1, evaluator: 2, institution_admin: 3, super_admin: 4 };

export const hasRole = (me: MeResponse | null, min: Role) => !!me && RANK[me.role] >= RANK[min];

export const TenantContext = createContext<{
  me: MeResponse | null;
  switchInstitution: (id: string) => void;
}>({ me: null, switchInstitution: () => {} });

export const useTenant = () => useContext(TenantContext);
