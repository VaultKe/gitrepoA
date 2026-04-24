import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { getThemeColors, spacing } from '../../utils/theme';
import aiOptimizationService from '../../services/aiOptimizationService';

const ResponseFeedback = ({
  questionId,
  responseId,
  onFeedbackSubmitted,
  visible = true
}) => {
  const { theme } = useApp();
  const colors = getThemeColors(theme);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [rating, setRating] = useState(0);
  const [improvements, setImprovements] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleQuickFeedback = async (isHelpful) => {
    try {
      setSubmitting(true);
      
      const feedback = {
        type: 'quick',
        helpful: isHelpful,
        rating: isHelpful ? 4 : 2,
        timestamp: new Date().toISOString()
      };

      await aiOptimizationService.trackResponseFeedback(
        questionId, 
        responseId, 
        feedback
      );

      setFeedbackGiven(true);
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(feedback);
      }

      // Show thank you message
      setTimeout(() => {
        setFeedbackGiven(false);
      }, 2000);

    } catch (error) {
      console.error('Failed to submit feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDetailedFeedback = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    try {
      setSubmitting(true);
      
      const feedback = {
        type: 'detailed',
        rating,
        improvements: improvements.trim(),
        helpful: rating >= 3,
        timestamp: new Date().toISOString()
      };

      await aiOptimizationService.trackResponseFeedback(
        questionId, 
        responseId, 
        feedback
      );

      setShowDetailedFeedback(false);
      setFeedbackGiven(true);
      
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(feedback);
      }

      // Reset form
      setRating(0);
      setImprovements('');

      // Show thank you message
      setTimeout(() => {
        setFeedbackGiven(false);
      }, 2000);

    } catch (error) {
      console.error('Failed to submit detailed feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  if (feedbackGiven) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.success + '15' }]}>
        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
        <Text style={[styles.compactThankYou, { color: colors.success }]}>
          Thanks for your feedback!
        </Text>
      </View>
    );
  }

  return (
    <>
      <View style={[styles.compactContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <Text style={[styles.compactQuestion, { color: colors.textSecondary }]}>
          Helpful?
        </Text>

        <View style={styles.compactButtons}>
          <TouchableOpacity
            style={[styles.compactButton, { borderColor: colors.success }]}
            onPress={() => handleQuickFeedback(true)}
            disabled={submitting}
          >
            <Ionicons name="thumbs-up" size={14} color={colors.success} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.compactButton, { borderColor: colors.error }]}
            onPress={() => handleQuickFeedback(false)}
            disabled={submitting}
          >
            <Ionicons name="thumbs-down" size={14} color={colors.error} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.compactButton, { borderColor: colors.textTertiary }]}
            onPress={() => setShowDetailedFeedback(true)}
            disabled={submitting}
          >
            <Ionicons name="ellipsis-horizontal" size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Detailed Feedback Modal */}
      <Modal
        visible={showDetailedFeedback}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetailedFeedback(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Help me improve
              </Text>
              <TouchableOpacity
                onPress={() => setShowDetailedFeedback(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.ratingLabel, { color: colors.text }]}>
              How would you rate this response?
            </Text>

            <View style={styles.ratingContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  style={styles.starButton}
                >
                  <Ionicons
                    name={star <= rating ? "star" : "star-outline"}
                    size={32}
                    color={star <= rating ? colors.warning : colors.textTertiary}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.improvementLabel, { color: colors.text }]}>
              How can I improve? (Optional)
            </Text>

            <TextInput
              style={[
                styles.improvementInput,
                {
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  borderColor: colors.border
                }
              ]}
              placeholder="Tell me what would make this response better..."
              placeholderTextColor={colors.textTertiary}
              value={improvements}
              onChangeText={setImprovements}
              multiline
              numberOfLines={4}
              maxLength={500}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setShowDetailedFeedback(false)}
                disabled={submitting}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { 
                    backgroundColor: colors.primary,
                    opacity: submitting ? 0.6 : 1
                  }
                ]}
                onPress={handleDetailedFeedback}
                disabled={submitting}
              >
                <Text style={[styles.submitButtonText, { color: colors.white }]}>
                  {submitting ? 'Submitting...' : 'Submit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Compact feedback styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
    borderRadius: 12,
    minHeight: 28,
  },
  compactQuestion: {
    fontSize: 11,
    fontWeight: '500',
  },
  compactButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  compactButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactThankYou: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  starButton: {
    padding: 4,
  },
  improvementLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  improvementInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 20,
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ResponseFeedback;
