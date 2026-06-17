export const roles = [
  { id: 'chairperson', name: 'Chairperson', icon: 'star', description: 'Full administrative access' },
  { id: 'treasurer', name: 'Treasurer', icon: 'wallet', description: 'Manages finances' },
  { id: 'secretary', name: 'Secretary', icon: 'document-text', description: 'Keeps records' },
  { id: 'assistant', name: 'Assistant', icon: 'person-add', description: 'Helps with operations' },
  { id: 'member', name: 'Member', icon: 'person', description: 'Regular member' },
];

export const getRoleIcon = (role) => {
  const roleData = roles.find(r => r.id === role);
  return roleData?.icon || 'person';
};

export const getRoleColor = (role, colors) => {
  switch (role) {
    case 'chairperson':
    case 'treasurer':
    case 'secretary':
      return colors.warning;
    case 'assistant':
      return colors.secondary;
    default:
      return colors.textSecondary;
  }
};

export const formatRoleLabel = (role = '') => {
  const label = role.charAt(0).toUpperCase() + role.slice(1);
  return label.length > 5 ? `${label.slice(0, 5)}...` : label;
};

export const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getMemberName = (item) => {
  const user = item?.user || {};
  const firstName = user?.first_name || item?.firstName || item?.first_name || '';
  const lastName = user?.last_name || item?.lastName || item?.last_name || '';
  const fullName = item?.fullName || `${firstName} ${lastName}`.trim();

  if (!fullName) {
    return user?.email || item?.email || `Member ${(item?.user_id || item?.id || '').slice(-4)}`;
  }

  return fullName;
};

export const getInvitationStatus = (invitation, colors) => {
  const now = new Date();
  const expiresAt = new Date(invitation.expires_at);

  if (invitation.status === 'accepted') return { status: 'accepted', color: colors.success };
  if (invitation.status === 'rejected') return { status: 'rejected', color: colors.error };
  if (invitation.status === 'cancelled') return { status: 'cancelled', color: colors.textSecondary };
  if (expiresAt < now) return { status: 'expired', color: colors.warning };
  return { status: 'pending', color: colors.primary };
};

export const getFilteredMembers = (members, searchQuery) => {
  if (!searchQuery) return members;

  const query = searchQuery.toLowerCase();
  return members.filter(member =>
    `${member.user?.first_name} ${member.user?.last_name}`.toLowerCase().includes(query) ||
    member.role.toLowerCase().includes(query)
  );
};

export const getFilteredInvitations = (invitations, searchQuery) => {
  if (!searchQuery) return invitations;

  const query = searchQuery.toLowerCase();
  return invitations.filter(inv =>
    inv.email.toLowerCase().includes(query) ||
    inv.status.toLowerCase().includes(query)
  );
};
