// utils/permissions.ts
import { decryptStr } from "@/helpers/helper";
export const getUserPermissions = (): string[] => {
  try {
    const u = localStorage.getItem("user_permissions");
    if (u) {
      const permissions = JSON.parse(decryptStr(u));
      return permissions;
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const getSystemModules = () => {
  try {
    const m = localStorage.getItem("modules");
    if (m) {
      return JSON.parse(m);
    }
    return [];
  } catch (e) {
    return [];
  }
};

export const hasPermission = (permissionName: string): boolean => {
  const permissions = getUserPermissions();
  return permissions.includes(permissionName);
};

/**
 * @param {Array} moduleNames - Module names to check
 *
 * @returns {Boolean} - True if user has at least one permission in any of the given modules
 */
export const hasPermissionInModules = (moduleNames: string[]): boolean => {
  const allModules = getSystemModules();
  const userPermissions = getUserPermissions();
  return allModules.some((module: { name: any; permissions: any[] }) => {
    if (!moduleNames.includes(module.name)) return false;

    return module.permissions.some((permission) =>
      userPermissions.includes(permission)
    );
  });
};
