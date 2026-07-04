import { makeRequest } from './api/client';
import Toast from 'react-native-toast-message';

export const sendApprovalNotification = async ({
  chamaId,
  recipientUserId,
  recipientName,
  recipientPhone,
  recipientEmail,
  disbursementType,
  disbursementId,
  entityLabel,
  amount,
  action = 'approved',
  initiatedBy,
  chamaName,
}) => {
  try {
    const title =
      action === 'approved'
        ? `Disbursement Approved - ${disbursementType}`
        : `Disbursement Ready for Approval - ${disbursementType}`;

    const body =
      action === 'approved'
        ? `${entityLabel || 'Disbursement'} of ${amount} has been approved by ${initiatedBy || 'a leader'}.`
        : `${entityLabel || 'Disbursement'} of ${amount} is ready for your approval.`;

    const payload = {
      chamaId,
      recipientUserId,
      recipientName,
      recipientPhone,
      recipientEmail,
      title,
      body,
      data: {
        type: 'disbursement_approval',
        disbursementType,
        disbursementId,
        entityLabel,
        amount,
        action,
        initiatedBy,
        chamaName,
      },
      channels: ['in_app', 'sms', 'email'],
    };

    const response = await makeRequest('/notifications/disbursement-approval', {
      method: 'POST',
      body: payload,
    });

    if (response.success) {
      return { success: true, data: response.data };
    }

    return { success: false, error: response.error || 'Failed to send notification' };
  } catch (error) {
    return { success: false, error: error.message || 'Notification error' };
  }
};

export const sendBulkApprovalNotification = async ({
  chamaId,
  recipientUserId,
  recipientName,
  recipientPhone,
  recipientEmail,
  disbursementType,
  disbursementIds,
  entityLabel,
  totalAmount,
  count,
  action = 'approved',
  initiatedBy,
  chamaName,
}) => {
  try {
    const title =
      action === 'approved'
        ? `Bulk Disbursement Approved - ${disbursementType}`
        : `Bulk Disbursement Ready for Approval - ${disbursementType}`;

    const body =
      action === 'approved'
        ? `Bulk disbursement of ${totalAmount} across ${count} items has been approved by ${initiatedBy || 'a leader'}.`
        : `Bulk disbursement of ${totalAmount} across ${count} items is ready for your approval.`;

    const payload = {
      chamaId,
      recipientUserId,
      recipientName,
      recipientPhone,
      recipientEmail,
      title,
      body,
      data: {
        type: 'bulk_disbursement_approval',
        disbursementType,
        disbursementIds,
        entityLabel,
        totalAmount,
        count,
        action,
        initiatedBy,
        chamaName,
      },
      channels: ['in_app', 'sms', 'email'],
    };

    const response = await makeRequest('/notifications/bulk-disbursement-approval', {
      method: 'POST',
      body: payload,
    });

    if (response.success) {
      return { success: true, data: response.data };
    }

    return { success: false, error: response.error || 'Failed to send notification' };
  } catch (error) {
    return { success: false, error: error.message || 'Notification error' };
  }
};

export const showInAppToast = ({ title, message, type = 'info' }) => {
  Toast.show({
    type,
    text1: title,
    text2: message,
  });
};
