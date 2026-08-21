export const getNotificationIcon = (type, priority) => {
  switch (type) {
    case 'chama_invitation':
      return 'mail';
    case 'guarantor_request':
      return 'shield-checkmark';
    case 'chama':
    case 'member_joined':
      return 'people';
    case 'meeting_scheduled':
    case 'meeting_started':
    case 'meeting_created':
      return 'calendar';
    case 'loan_application_submitted':
    case 'loan_approved':
    case 'loan_disbursed':
    case 'loan_rejected':
    case 'loan_application_new':
    case 'loan_approved_member':
      return 'cash';
    case 'welfare_request_created':
    case 'welfare_approved':
    case 'welfare_rejected':
    case 'welfare_request_new':
    case 'welfare_approved_member':
      return 'heart';
    case 'contribution_recorded':
    case 'welfare_contribution_recorded':
    case 'loan_payment_recorded':
    case 'member_contribution':
    case 'member_welfare_contribution':
      return 'wallet';
    case 'financial':
      return 'card';
    case 'loan':
      return 'cash';
    case 'marketplace':
      return 'storefront';
    case 'system':
      return priority === 'high' ? 'warning' : 'information-circle';
    case 'support_update':
    case 'new_support_request':
      return 'help-circle';
    default:
      return 'notifications';
  }
};

export const getNotificationColor = (type, priority, colors) => {
  switch (type) {
    case 'chama_invitation':
    case 'chama':
    case 'member_joined':
      return colors.primary;
    case 'guarantor_request':
      return colors.warning;
    case 'meeting_scheduled':
    case 'meeting_started':
    case 'meeting_created':
      return colors.info;
    case 'loan_application_submitted':
    case 'loan_approved':
    case 'loan_disbursed':
    case 'loan_rejected':
    case 'loan_application_new':
    case 'loan_approved_member':
      return colors.warning;
    case 'welfare_request_created':
    case 'welfare_approved':
    case 'welfare_rejected':
    case 'welfare_request_new':
    case 'welfare_approved_member':
      return colors.error;
    case 'contribution_recorded':
    case 'welfare_contribution_recorded':
    case 'loan_payment_recorded':
    case 'member_contribution':
    case 'member_welfare_contribution':
      return colors.success;
    case 'financial':
      return colors.success;
    case 'loan':
      return colors.warning;
    case 'marketplace':
      return colors.info;
    case 'system':
      return priority === 'high' ? colors.error : colors.secondary;
    case 'support_update':
    case 'new_support_request':
      return colors.info;
    default:
      return colors.textSecondary;
  }
};
