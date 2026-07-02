import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Card from '../../../components/common/Card';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius, breakpoints } from '../../../utils/theme';
import api from '../../../services/api';
import { getChamaSubscriptionPayments, paySubscriptionPayment } from '../../../services/api/chamaEndpoints';
import { generatePDFOptimizedReceiptHTML } from '../../../services/receiptService/html/template';
import { COMPANY_INFO } from '../../../services/receiptService/config';

const SubscriptionManagementScreen = ({ route, navigation }) => {
  const { chamaId } = route.params;
  const { theme, userRole, user } = useApp();
  const colors = getThemeColors(theme);
  console.log('[DEBUG Sub] userRole from context:', userRole, 'theme:', theme);
  const styles = createStyles(colors);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const isDesktop = screenWidth >= breakpoints.lg;

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [page, setPage] = useState(1);
  const [memberRole, setMemberRole] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const PER_PAGE = 12;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    loadSubscriptions();
    loadMemberRole();
  }, [chamaId]);

  const loadMemberRole = async () => {
    try {
      const response = await api.makeRequest(`/chamas/${chamaId}/members`);
      if (response.success && response.data) {
        const members = Array.isArray(response.data) ? response.data : [response.data];
        const currentUser = members.find(m => m.userId === user?.id || m.user_id === user?.id);
        if (currentUser) {
          const role = (currentUser.role || currentUser.memberRole || '').toLowerCase();
          setMemberRole(role || null);
          console.log('[DEBUG Sub] Loaded member role:', role, 'for user:', user?.id);
        } else {
          console.log('[DEBUG Sub] Current user not found in members list');
        }
      }
    } catch (error) {
      console.log('Could not load member role:', error);
    }
  };

  const loadSubscriptions = async () => {
    console.log('[DEBUG Sub] loadSubscriptions called for chamaId:', chamaId);
    try {
      setLoading(true);
      const response = await getChamaSubscriptionPayments(chamaId);
      console.log('[DEBUG Sub] API response:', JSON.stringify(response, null, 2));
      if (response.success && response.data) {
        console.log('[DEBUG Sub] Received', response.data.length, 'subscriptions');
        setSubscriptions(response.data);
      } else {
        console.log('[DEBUG Sub] No data in response or failed');
        setSubscriptions([]);
      }
    } catch (error) {
      console.error('[DEBUG Sub] Error loading subscriptions:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load subscriptions',
        text2: error.message || 'Please try again',
      });
    } finally {
      console.log('[DEBUG Sub] loadSubscriptions done, loading set to false');
      setLoading(false);
    }
  };

  const handlePaySubscription = async (payment) => {
    const normalizedUserRole = (userRole || '').toLowerCase();
    const normalizedMemberRole = (memberRole || '').toLowerCase();
    const canPay = ['admin'].includes(normalizedUserRole) || ['chairperson', 'treasurer'].includes(normalizedMemberRole);
    console.log('[DEBUG Sub] handlePaySubscription called for payment:', payment.id, 'amount:', payment.amount, 'status:', payment.status, 'userRole:', userRole, 'memberRole:', memberRole, 'canPay:', canPay);

    if (!canPay) {
      console.log('[DEBUG Sub] Access denied - userRole:', userRole, 'normalized:', normalizedUserRole, 'memberRole:', memberRole);
      Toast.show({
        type: 'error',
        text1: 'Access Denied',
        text2: 'Only chairperson or treasurer can initiate payments',
      });
      return;
    }

    try {
      setPayingId(payment.id);
      console.log('[DEBUG Sub] Calling paySubscriptionPayment for', payment.id);
      const response = await paySubscriptionPayment(chamaId, payment.id);
      console.log('[DEBUG Sub] Payment response:', JSON.stringify(response, null, 2));
      if (response.success) {
        Toast.show({
          type: 'success',
          text1: 'Payment Initiated',
          text2: 'STK push sent to your phone',
        });
        loadSubscriptions();
      } else {
        const errorMsg = response.error || 'Failed to initiate payment';
        console.log('[DEBUG Sub] Payment failed:', errorMsg);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('[DEBUG Sub] Payment error:', error);
      Toast.show({
        type: 'error',
        text1: 'Payment Failed',
        text2: error.message || 'Failed to initiate payment',
      });
    } finally {
      setPayingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return `KES ${Number(amount).toLocaleString()}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return colors.success;
      case 'pending': return colors.warning;
      case 'overdue': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'overdue': return 'alert-circle';
      default: return 'help-circle';
    }
  };

  const getReceiptId = (sub) => {
    return `RCP-${String(sub?.id || sub?.transactionId || Date.now()).substring(0, 8).toUpperCase()}`;
  };

  const getReceiptFileName = (receiptId) => {
    return `VaultKe_Receipt_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
  };

  const getReceiptBodyHTML = (html) => {
    const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return match ? match[1].trim() : html;
  };

  const openReceiptPrintWindow = (html, title, receiptId) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.open) {
      return { success: false, error: 'Print is not available on this device' };
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      return { success: false, error: 'Popup blocked. Allow popups to print receipts.' };
    }

    const isFullHTMLDocument = /<!DOCTYPE html>[\s\S]*<\/html>/i.test(html) || /<html[\s\S]*<\/html>/i.test(html);
    const documentHTML = isFullHTMLDocument
      ? html
      : `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${title}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif !important; color: #000 !important; background: white !important; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;

    printWindow.document.open();
    printWindow.document.write(documentHTML);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);

    return { success: true, fileName: getReceiptFileName(receiptId) };
  };

  const printReceiptHTML = async (html, title, receiptId) => {
    if (Platform.OS === 'web') {
      return openReceiptPrintWindow(getReceiptBodyHTML(html), title, receiptId);
    }

    if (!Print?.printAsync) {
      return { success: false, error: 'Print is not available on this device' };
    }

    await Print.printAsync({ html, base64: false });
    return { success: true, fileName: getReceiptFileName(receiptId) };
  };

  const downloadReceiptHTML = async (html, fileName) => {
    if (Platform.OS === 'web') {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      return { success: true, fileName };
    }

    if (!FileSystem?.documentDirectory || !Sharing?.isAvailableAsync) {
      throw new Error('Download is not available on this device');
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Download is not available on this device');
    }

    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, html, { encoding: FileSystem.EncodingType.UTF8 });

    await Sharing.shareAsync(uri, {
      mimeType: 'text/html',
      dialogTitle: 'Download subscription receipt',
      UTI: 'public.html',
    });

    return { success: true, fileName, uri };
  };

  const buildReceiptHTML = (sub) => {
    const transaction = {
      id: sub?.id,
      date: sub?.paidAt || sub?.createdAt || sub?.dueDate,
      amount: sub?.amount || 0,
      status: 'paid',
      type: 'payment',
      description: 'Monthly Subscription Payment',
      reference: sub?.transactionId || sub?.id || 'N/A',
      fees: 0,
    };

    return generatePDFOptimizedReceiptHTML(transaction, 'Chama Subscription', user?.chamaName || 'Chama', COMPANY_INFO);
  };

  const buildInvoiceHTML = (sub) => {
    const transaction = {
      id: sub?.id,
      date: sub?.paidAt || sub?.createdAt || sub?.dueDate,
      amount: sub?.amount || 0,
      status: sub?.status || 'pending',
      type: 'payment',
      description: 'Monthly Subscription Payment',
      reference: sub?.transactionId || sub?.id || 'N/A',
      fees: 0,
    };

    const receiptHTML = generatePDFOptimizedReceiptHTML(transaction, 'Chama Subscription', user?.chamaName || 'Chama', COMPANY_INFO);
    return receiptHTML.replace(/TRANSACTION RECEIPT/g, 'INVOICE').replace(/Transaction Receipt/g, 'Invoice').replace(/RECEIPT/g, 'INVOICE').replace(/Receipt/g, 'Invoice');
  };

  const handlePrintSubscriptionReceipt = async (sub) => {
    if (!sub) return;
    setReceiptLoading(true);
    try {
      const receiptId = getReceiptId(sub);
      const html = buildReceiptHTML(sub);
      const result = await printReceiptHTML(
        html,
        `Subscription Receipt - ${receiptId}`,
        receiptId
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to print receipt');
      }
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print receipt.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleDownloadInvoice = async (sub) => {
    if (!sub) return;
    setReceiptLoading(true);
    try {
      const receiptId = getReceiptId(sub);
      const html = buildInvoiceHTML(sub);
      const fileName = `VaultKe_Invoice_${receiptId}_${new Date().toISOString().split('T')[0]}.html`;
      const result = await downloadReceiptHTML(html, fileName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to download invoice');
      }
      Toast.show({
        type: 'success',
        text1: 'Invoice Downloaded',
        text2: `Invoice saved as ${result.fileName}`,
      });
    } catch (error) {
      Alert.alert('Download Failed', error.message || 'Failed to download invoice.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePrintAllPaidSubscriptions = async () => {
    const paidSubs = subscriptions.filter(s => s.status === 'paid');
    if (paidSubs.length === 0) {
      Alert.alert('No Paid Subscriptions', 'There are no paid subscriptions to print.', [{ text: 'OK' }]);
      return;
    }

    setReceiptLoading(true);
    try {
      const rows = paidSubs.map((sub) => `
        <tr>
          <td>${sub.id}</td>
          <td>${sub.dueDate || sub.createdAt || 'N/A'}</td>
          <td>${sub.amount || 0}</td>
          <td>${sub.status || 'N/A'}</td>
          <td>${sub.transactionId || sub.id || 'N/A'}</td>
          <td>${sub.paidAt || 'N/A'}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Subscription Payments Report</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { font-family: Arial, sans-serif !important; color: #000 !important; background: white !important; }
              table { width: 100% !important; border-collapse: collapse !important; margin-top: 15px !important; }
              th, td { border: 1px solid #000 !important; padding: 8px !important; text-align: left !important; font-size: 12px !important; }
              th { background: #e8e8e8 !important; font-weight: bold !important; }
            </style>
          </head>
          <body>
            <h2>Subscription Payments Report</h2>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <p>Total Paid: ${paidSubs.length}</p>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Transaction ID</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>
      `;

      const result = await printReceiptHTML(html, 'Subscription Payments Report', 'SUB-ALL');
      if (!result.success) {
        throw new Error(result.error || 'Failed to print report');
      }
    } catch (error) {
      Alert.alert('Print Failed', error.message || 'Failed to print subscriptions.', [{ text: 'OK' }]);
    } finally {
      setReceiptLoading(false);
    }
  };

  const totalPages = Math.ceil(subscriptions.length / PER_PAGE);
  const startIndex = (page - 1) * PER_PAGE;
  const paginatedSubscriptions = subscriptions.slice(startIndex, startIndex + PER_PAGE);

  const renderSubscriptionTable = () => {
    console.log('[DEBUG Sub] renderSubscriptionTable called. loading:', loading, 'subscriptions.length:', subscriptions.length, 'page:', page, 'PER_PAGE:', PER_PAGE);

    if (loading) {
      console.log('[DEBUG Sub] Showing loading spinner');
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (subscriptions.length === 0) {
      console.log('[DEBUG Sub] No subscriptions - showing empty state');
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="repeat-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No subscription payments yet
          </Text>
        </View>
      );
    }

    console.log('[DEBUG Sub] Rendering table with', paginatedSubscriptions.length, 'items on page', page, 'of', totalPages);
    paginatedSubscriptions.forEach((sub, i) => {
      console.log('[DEBUG Sub] Row', i, '- id:', sub.id, 'status:', sub.status, 'amount:', sub.amount, 'dueDate:', sub.dueDate, 'isUnpaid:', sub.status !== 'paid');
    });

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          <View style={[styles.tableHeader, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1.5 }]}>Due Date</Text>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1 }]}>Amount</Text>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1.5 }]}>Status</Text>
            <Text style={[styles.tableHeaderText, { color: colors.primary, flex: 1, minWidth: 60, textAlign: 'center' }]}>Action</Text>
            {subscriptions.some(s => s.status === 'paid') && (
              <TouchableOpacity
                style={[styles.printAllButton, { backgroundColor: colors.success }]}
                onPress={handlePrintAllPaidSubscriptions}
                disabled={receiptLoading}
              >
                <Ionicons name="print" size={14} color={colors.white} />
                <Text style={[styles.printAllButtonText, { color: colors.white }]}>Print All Paid</Text>
              </TouchableOpacity>
            )}
          </View>
          {paginatedSubscriptions.map((sub, index) => {
            const isEven = index % 2 === 0;
            const isPaying = payingId === sub.id;
            const isUnpaid = sub.status !== 'paid';
            console.log('[DEBUG Sub] Rendering row', index, 'id:', sub.id, 'status:', sub.status, 'isUnpaid:', isUnpaid, 'payButton visible:', isUnpaid);
            return (
              <View
                key={sub.id}
                style={[
                  styles.tableRow,
                  { backgroundColor: isEven ? colors.background : colors.surface }
                ]}
              >
                <Text style={[styles.tableCell, { color: colors.text, flex: 1.5 }]}>
                  {formatDate(sub.dueDate || sub.createdAt)}
                </Text>
                <Text style={[styles.tableCell, { color: colors.text, flex: 1 }]}>
                  {formatCurrency(sub.amount)}
                </Text>
                <View style={[styles.statusCell, { flex: 1.5 }]}>
                  <Ionicons
                    name={getStatusIcon(sub.status)}
                    size={14}
                    color={getStatusColor(sub.status)}
                  />
                  <Text style={[
                    styles.statusText,
                    { color: getStatusColor(sub.status) }
                  ]}>
                    {sub.status?.charAt(0).toUpperCase() + sub.status?.slice(1)}
                  </Text>
                </View>
                <View style={[styles.actionCell, { flex: 1 }]}>
                  {isUnpaid ? (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.payButton, { backgroundColor: colors.primary }]}
                        onPress={() => handlePaySubscription(sub)}
                        disabled={isPaying}
                      >
                        {isPaying ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={[styles.payButtonText, { color: colors.white }]}>
                            Pay
                          </Text>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.invoiceButton, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}
                        onPress={() => handleDownloadInvoice(sub)}
                        disabled={receiptLoading}
                      >
                        <Ionicons name="document-text-outline" size={14} color={colors.warning} />
                        <Text style={[styles.invoiceButtonText, { color: colors.warning }]}>Invoice</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={[styles.receiptButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
                        onPress={() => handlePrintSubscriptionReceipt(sub)}
                        disabled={receiptLoading}
                      >
                        <Ionicons name="print" size={14} color={colors.success} />
                        <Text style={[styles.receiptButtonText, { color: colors.success }]}>Receipt</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.invoiceButton, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}
                        onPress={() => handleDownloadInvoice(sub)}
                        disabled={receiptLoading}
                      >
                        <Ionicons name="document-text-outline" size={14} color={colors.warning} />
                        <Text style={[styles.invoiceButtonText, { color: colors.warning }]}>Invoice</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, { opacity: page === 1 ? 0.5 : 1 }]}
          onPress={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <Ionicons name="chevron-back" size={16} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.pageText, { color: colors.text }]}>
          {page} / {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.pageButton, { opacity: page === totalPages ? 0.5 : 1 }]}
          onPress={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Monthly Subscriptions
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Manage monthly subscription payments for this chama. Unpaid subscriptions will show a Pay button.
          </Text>
        </Card>

        <Card variant="outlined" style={styles.tableCard}>
          {renderSubscriptionTable()}
          {renderPagination()}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.md,
  },
  tableCard: {
    borderRadius: 12,
    marginBottom: spacing.lg,
    padding: 12,
    backgroundColor: colors.background,
  },
  table: {
    minWidth: 420,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
    marginBottom: 4,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  table: {
    minWidth: 420,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    alignItems: 'center',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
  },
  tableCell: {
    fontSize: 12,
  },
  statusCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  printAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
    marginLeft: 8,
  },
  printAllButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    minWidth: 60,
  },
  receiptButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    minWidth: 60,
  },
  invoiceButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pageButton: {
    padding: spacing.sm,
    borderRadius: 6,
  },
  pageText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default SubscriptionManagementScreen;
