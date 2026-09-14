import { NextResponse } from "next/server";
import { requireStaff } from "@/middlewares/rbac";
import { getAllRoles } from "@/lib/roleModel";
import { getDbForStats } from "@/lib/roleModel";
import { ApiError } from "@/utils/http";

// Read-only view of the roles managed in Level 1 (ad-buzz /admin/roles).
// Writes are intentionally NOT exposed here — Level 1 is the sole authority.
export async function GET(request) {
  try {
    await requireStaff(request);
    const [roles, db] = await Promise.all([getAllRoles(), getDbForStats()]);
    const stats = await db
      .collection("users")
      .aggregate([
        {
          $group: {
            _id: { $ifNull: ["$role", "customer"] },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const counts = new Map(stats.map((s) => [s._id, s.count]));

    return NextResponse.json({
      success: true,
      roles: roles.map((r) => ({
        key: r.key,
        name: r.name,
        label: r.label,
        description: r.description,
        permissions: r.permissions || [],
        level2Routes: r.level2Routes,
        isSystem: !!r.isSystem,
        userCount: counts.get(r.key) || 0,
        permissionCount: Array.isArray(r.permissions) ? r.permissions.length : 0,
      })),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.status }
      );
    }
    console.error("[roles] list failed:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Failed to fetch roles." },
      { status: 500 }
    );
  }
}
