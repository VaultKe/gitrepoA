import { generatePDFReceipt, generateHTMLReceipt, generateJSONReceipt, generateWebDownload, getMimeType, getUTI } from './generators/pdfGenerator';
import { getMemberNameFromTransaction } from './memberName';
import { formatDate, formatCurrency } from './formatters';
import { COMPANY_INFO } from './config';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

class ReceiptService {
  constructor() {
    this.companyInfo = COMPANY_INFO;
  }

  formatDate = formatDate;
  formatCurrency = formatCurrency;

  getMemberNameFromTransaction = getMemberNameFromTransaction;

  generatePDFReceipt = generatePDFReceipt;
  generateHTMLReceipt = generateHTMLReceipt;
  generateJSONReceipt = generateJSONReceipt;

  generateWebDownload = generateWebDownload;
  getMimeType = getMimeType;
  getUTI = getUTI;

  async downloadReceipt(transaction, format = 'pdf', userInfo = {}) {
    try {
      let result;

      switch (format.toLowerCase()) {
        case 'pdf':
          result = await this.generatePDFReceipt(transaction, userInfo);
          break;
        case 'html':
          result = await this.generateHTMLReceipt(transaction, userInfo);
          break;
        case 'json':
          result = await this.generateJSONReceipt(transaction, userInfo);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      if (result.success) {
        Alert.alert(
          'Success',
          `Receipt downloaded successfully as ${result.fileName}`,
          [
            { text: 'OK' },
            {
              text: 'Share',
              onPress: () => this.shareReceipt(result.uri, result.fileName)
            }
          ]
        );
      } else {
        Alert.alert('Error', `Failed to download receipt: ${result.error}`);
      }

      return result;
    } catch (error) {
      Alert.alert('Error', 'Failed to download receipt');
      return { success: false, error: error.message };
    }
  }

  async shareReceipt(uri, fileName) {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return { success: false, error: 'Sharing not available' };
      }

      await Sharing.shareAsync(uri, {
        mimeType: this.getMimeType(fileName),
        dialogTitle: `Share ${fileName}`,
        UTI: this.getUTI(fileName)
      });

      return { success: true };
    } catch (error) {
      Alert.alert('Error', 'Failed to share receipt');
      return { success: false, error: error.message };
    }
  }
}

const receiptService = new ReceiptService();
export default receiptService;