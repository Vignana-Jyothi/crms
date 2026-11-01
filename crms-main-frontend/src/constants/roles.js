export const ROLES = {
  SUPER_ADMIN: 1,
  INSTITUTE_ADMIN: 2,
  DEPARTMENT_ADMIN: 3,
  REQUESTER: 4,
  VIEWER: 5,
};

export const ADMINS = [ROLES.SUPER_ADMIN, ROLES.INSTITUTE_ADMIN, ROLES.DEPARTMENT_ADMIN];

// Everyone who can book a room. Viewers only look.
export const BOOKERS = [...ADMINS, ROLES.REQUESTER];
