/**
 * Permission helpers for role-based access.
 *
 * Every helper takes a `PermissionSession` — a slim view of the NextAuth
 * session sufficient for access checks. Server components and API routes
 * can pass the whole `session` object; TypeScript structural typing lets
 * it match PermissionSession.
 *
 * Two primitives do the heavy lifting:
 *   - isMinistryHead(s, ministryId)   — head of this specific ministry, or admin
 *   - isMinistryMember(s, ministryId) — member (head or plain) of this ministry, or admin
 *
 * Every other helper is built on top of these.
 */

export interface PermissionSession {
  isAdmin: boolean;
  ministryIds: string[];
  headOfMinistryIds: string[];
}

// --- Primitives ---

export function isMinistryHead(s: PermissionSession, ministryId: string): boolean {
  return s.isAdmin || s.headOfMinistryIds.includes(ministryId);
}

export function isMinistryMember(s: PermissionSession, ministryId: string): boolean {
  return s.isAdmin || s.ministryIds.includes(ministryId);
}

// --- Top-level access ---

export function canAccessUsers(s: PermissionSession): boolean {
  return s.isAdmin || s.headOfMinistryIds.length > 0;
}

export function canAccessSettings(s: PermissionSession): boolean {
  return s.isAdmin;
}

export function canAccessForms(s: PermissionSession): boolean {
  return s.isAdmin || s.headOfMinistryIds.length > 0;
}

export function canAccessReports(s: PermissionSession): boolean {
  return s.isAdmin;
}

export function canAccessPrayers(): boolean {
  return true;
}

export function canAccessLineup(): boolean {
  return true;
}

// --- Settings management (admin only) ---

export function canManageInstrumentsAndSingers(s: PermissionSession): boolean {
  return s.isAdmin;
}

export function canManageMinistry(s: PermissionSession): boolean {
  return s.isAdmin;
}

// --- ARF/PRF ---

/** Members of the target ministry can create drafts (or admin). */
export function canCreateDraftARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryMember(s, targetMinistryId);
}

/** Only heads of the target ministry can create pending-state requests (or admin). */
export function canCreateARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryHead(s, targetMinistryId);
}

export function canApproveARFOrPRF(s: PermissionSession, targetMinistryId: string): boolean {
  return isMinistryHead(s, targetMinistryId);
}

// --- Lineup ---

export function canCreateLineup(s: PermissionSession, musicMinistryId: string): boolean {
  return isMinistryMember(s, musicMinistryId);
}

export function canApproveLineup(s: PermissionSession, musicMinistryId: string): boolean {
  return isMinistryHead(s, musicMinistryId);
}

export function canSeeDraftLineup(
  s: PermissionSession,
  createdById: string,
  currentUserId: string
): boolean {
  return s.isAdmin || createdById === currentUserId;
}

// --- Prayer (Parakletos-scoped) ---

export function canManagePrayer(
  s: PermissionSession,
  parakletosMinistryId: string,
  createdById: string,
  currentUserId: string
): { canView: boolean; canEdit: boolean; canDelete: boolean; canSetStatus: boolean } {
  if (s.isAdmin) {
    return { canView: true, canEdit: true, canDelete: true, canSetStatus: true };
  }
  if (createdById === currentUserId) {
    return { canView: true, canEdit: true, canDelete: true, canSetStatus: false };
  }
  if (isMinistryHead(s, parakletosMinistryId)) {
    return { canView: true, canEdit: false, canDelete: true, canSetStatus: true };
  }
  if (isMinistryMember(s, parakletosMinistryId)) {
    return { canView: true, canEdit: false, canDelete: false, canSetStatus: true };
  }
  return { canView: false, canEdit: false, canDelete: false, canSetStatus: false };
}

export function canViewAllPrayers(s: PermissionSession, parakletosMinistryId: string): boolean {
  return isMinistryMember(s, parakletosMinistryId);
}

// --- Multimedia checklist ---

export function canViewChecklistHistory(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryMember(s, multimediaMinistryId);
}

export function canToggleChecklistItem(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryMember(s, multimediaMinistryId);
}

export function canEditChecklistTemplate(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryHead(s, multimediaMinistryId);
}

export function canManageChecklistRuns(
  s: PermissionSession,
  multimediaMinistryId: string
): boolean {
  return isMinistryHead(s, multimediaMinistryId);
}
