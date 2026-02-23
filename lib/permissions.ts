/**
 * Role-based access helpers.
 * Role slugs: admin, ministry_head, user (normal user).
 */

export type RoleSlug = "admin" | "ministry_head" | "user";

export function canAccessUsers(roleSlug: RoleSlug): boolean {
  return roleSlug === "admin" || roleSlug === "ministry_head";
}

export function canAccessSettings(roleSlug: RoleSlug): boolean {
  return roleSlug === "admin";
}

/** Admin and ministry head (e.g. Music Head) can add instruments and singer roles for lineups. */
export function canManageInstrumentsAndSingers(roleSlug: RoleSlug): boolean {
  return roleSlug === "admin" || roleSlug === "ministry_head";
}

/** Only admin and ministry heads can access Forms (ARF, PRF). */
export function canAccessForms(roleSlug: RoleSlug): boolean {
  return roleSlug === "admin" || roleSlug === "ministry_head";
}

export function canCreateARFOrPRF(roleSlug: RoleSlug): boolean {
  return roleSlug === "admin" || roleSlug === "ministry_head";
}

/** Ordinary users can create drafts; ministry_head/admin can create and submit. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- API signature requires param for consistency
export function canCreateDraftARFOrPRF(_roleSlug: RoleSlug): boolean {
  return true;
}

/** Everyone can view lineups. Params kept for API consistency with canCreateLineup. */
/* eslint-disable @typescript-eslint/no-unused-vars -- params reserved for future use */
export function canAccessLineup(
  _roleSlug?: RoleSlug,
  _userMinistryIds?: string[],
  _musicMinistryId?: string
): boolean {
  return true;
}
/* eslint-enable @typescript-eslint/no-unused-vars */

/** Only admin OR user in Music ministry can create lineups. */
export function canCreateLineup(
  roleSlug: RoleSlug,
  userMinistryIds: string[],
  musicMinistryId: string
): boolean {
  if (roleSlug === "admin") return true;
  return userMinistryIds.includes(musicMinistryId);
}

export function canManageMinistry(
  roleSlug: RoleSlug,
  userMinistryIdOrIds: string | string[] | null,
  targetMinistryId: string
): boolean {
  if (roleSlug === "admin") return true;
  const ids = Array.isArray(userMinistryIdOrIds)
    ? userMinistryIdOrIds
    : userMinistryIdOrIds
      ? [userMinistryIdOrIds]
      : [];
  return roleSlug === "ministry_head" && ids.includes(targetMinistryId);
}

export function canApproveLineup(roleSlug: RoleSlug): boolean {
  return roleSlug === "admin" || roleSlug === "ministry_head";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- API signature requires param for consistency
export function canAccessPrayers(_roleSlug: RoleSlug): boolean {
  return true;
}

export function isParakletosMinistryHead(
  roleSlug: RoleSlug,
  userMinistryIdOrIds: string | string[] | null,
  parakletosMinistryId: string
): boolean {
  const ids = Array.isArray(userMinistryIdOrIds)
    ? userMinistryIdOrIds
    : userMinistryIdOrIds
      ? [userMinistryIdOrIds]
      : [];
  return roleSlug === "ministry_head" && ids.includes(parakletosMinistryId);
}

export function isParakletosMember(
  userMinistryIdOrIds: string | string[] | null,
  parakletosMinistryId: string
): boolean {
  const ids = Array.isArray(userMinistryIdOrIds)
    ? userMinistryIdOrIds
    : userMinistryIdOrIds
      ? [userMinistryIdOrIds]
      : [];
  return ids.includes(parakletosMinistryId);
}

export function canManagePrayer(
  roleSlug: RoleSlug,
  userMinistryIdOrIds: string | string[] | null,
  parakletosMinistryId: string,
  createdById: string,
  userId: string
): { canView: boolean; canEdit: boolean; canDelete: boolean; canSetStatus: boolean } {
  if (roleSlug === "admin") {
    return { canView: true, canEdit: true, canDelete: true, canSetStatus: true };
  }
  if (createdById === userId) {
    return { canView: true, canEdit: true, canDelete: true, canSetStatus: false };
  }
  if (isParakletosMinistryHead(roleSlug, userMinistryIdOrIds, parakletosMinistryId)) {
    return { canView: true, canEdit: false, canDelete: true, canSetStatus: true };
  }
  if (isParakletosMember(userMinistryIdOrIds, parakletosMinistryId)) {
    return { canView: true, canEdit: false, canDelete: false, canSetStatus: true };
  }
  return { canView: false, canEdit: false, canDelete: false, canSetStatus: false };
}

export function canViewAllPrayers(
  roleSlug: RoleSlug,
  userMinistryIdOrIds: string | string[] | null,
  parakletosMinistryId: string
): boolean {
  if (roleSlug === "admin") return true;
  if (isParakletosMinistryHead(roleSlug, userMinistryIdOrIds, parakletosMinistryId)) return true;
  if (isParakletosMember(userMinistryIdOrIds, parakletosMinistryId)) return true;
  return false;
}

/** Draft lineups: only creator and admin can see. Ministry heads do NOT see drafts (to avoid confusion). */
export function canSeeDraftLineup(
  roleSlug: RoleSlug,
  createdById: string,
  _ministryId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future ministry-scoped checks
  _userMinistryIdOrIds: string | string[] | null
): boolean {
  if (roleSlug === "admin") return true;
  if (createdById === userId) return true;
  return false;
}
