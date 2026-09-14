import { getCollection, getDb } from "@/lib/db";
import { SYSTEM_ROLE_DEFAULTS } from "@/lib/rbacCatalog";

const COLLECTION = "roles";

// Read-only mirror of the Level 1 authority. Level 1 (ad-buzz) owns writes;
// Level 2 only reads the shared `roles` collection (same `ad_buzz` database)
// plus ensures missing system roles exist (never overwrites customisations).

export async function getRolesCollection() {
  return getCollection(COLLECTION);
}

export async function ensureSystemRoles() {
  const col = await getRolesCollection();
  const now = new Date();
  const ops = SYSTEM_ROLE_DEFAULTS.map((def) => ({
    updateOne: {
      filter: { key: def.key },
      update: {
        $setOnInsert: {
          key: def.key,
          name: def.name,
          label: def.label,
          description: def.description,
          permissions: def.permissions,
          level2Routes: def.level2Routes,
          isSystem: def.isSystem,
          createdAt: now,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));
  if (ops.length) await col.bulkWrite(ops);
  try {
    await col.createIndex({ key: 1 }, { unique: true });
  } catch {
    // index already exists — ignore
  }
  return col;
}

export async function getAllRoles() {
  const col = await ensureSystemRoles();
  return col.find({}).sort({ isSystem: -1, name: 1 }).toArray();
}

export async function getRoleByKey(key) {
  const col = await ensureSystemRoles();
  return col.findOne({ key });
}

export async function getEffectivePermissions(roleKey) {
  const role = await getRoleByKey(roleKey);
  if (role && Array.isArray(role.permissions)) return role.permissions;
  const fallback = SYSTEM_ROLE_DEFAULTS.find((r) => r.key === roleKey);
  return fallback ? fallback.permissions : [];
}

// null = unrestricted (legacy behaviour — never blocks existing users).
export async function getEffectiveLevel2Routes(roleKey) {
  if (roleKey === "admin") return null; // admin bypasses page restrictions
  const role = await getRoleByKey(roleKey);
  if (role && (Array.isArray(role.level2Routes) || role.level2Routes === null)) {
    return role.level2Routes;
  }
  const fallback = SYSTEM_ROLE_DEFAULTS.find((r) => r.key === roleKey);
  return fallback ? fallback.level2Routes : null;
}

export async function getAccessMap() {
  const roles = await getAllRoles();
  const permissions = {};
  const routes = {};
  for (const r of roles) {
    if (Array.isArray(r.permissions)) permissions[r.key] = r.permissions;
    if (Array.isArray(r.level2Routes) || r.level2Routes === null) routes[r.key] = r.level2Routes;
  }
  return { permissions, routes };
}

export async function getDbForStats() {
  return getDb();
}
