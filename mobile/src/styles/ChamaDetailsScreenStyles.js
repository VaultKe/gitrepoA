import { StyleSheet } from 'react-native';
import { spacing, typography, borderRadius } from '../utils/theme';

const getResponsiveStyles = (screenType, screenWidth) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: screenType === 'desktop' ? typography.fontSize.lg : typography.fontSize.base,
    textAlign: 'center',
  },
  section: {
    marginHorizontal: spacing.sm,
    marginVertical: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  // Smart responsive layout styles
  flexibleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: 0, // Remove bottom margin since cards have their own
  },
  flexibleCard: {
    marginHorizontal: spacing.xs,
    // Ensure cards in the same row have consistent height
    minHeight: 200,
  },
  fullWidthRow: {
    marginHorizontal: 0, // Full width cards manage their own margins
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
  },
  chamaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  chamaAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  chamaInfo: {
    flex: 1,
  },
  chamaName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  chamaType: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  chamaDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20, // Fixed line height for better mobile readability
    marginBottom: spacing.md,
    textAlign: 'left',
    letterSpacing: 0.2,
    paddingHorizontal: spacing.xs, // Add slight horizontal padding
  },
  rulesSection: {
    marginTop: spacing.md,
  },
  rulesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  rulesText: {
    fontSize: typography.fontSize.sm,
    lineHeight: typography.lineHeight.relaxed,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statValue: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  membershipInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  membershipTitle: {
    fontSize: typography.fontSize.base,
    marginBottom: spacing.xs,
  },
  membershipRole: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing.xs,
  },
  membershipDate: {
    fontSize: typography.fontSize.sm,
  },
  membershipActions: {
    gap: spacing.md,
  },
  membershipButton: {
    marginBottom: spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    padding: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontSize.base,
  },
  skeletonCard: {
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    marginBottom: spacing.sm,
  },
  // New styles for comprehensive view
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewMoreText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: spacing.lg,
  },
  // Members styles
  membersList: {
    gap: spacing.sm,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  memberAvatar: {
    width: 70,
    height: 70,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    overflow: 'hidden', // Ensures image stays within circular bounds
    backgroundColor: '#f0f0f0', // Light background for loading state
  },
  memberInitials: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  memberRole: {
    fontSize: typography.fontSize.xs,
  },
  memberStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  memberStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  // Meetings styles
  meetingsList: {
    gap: spacing.sm,
  },
  meetingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  meetingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  meetingDate: {
    fontSize: typography.fontSize.xs,
    marginBottom: spacing.xs,
  },
  meetingType: {
    fontSize: typography.fontSize.xs,
  },
  meetingStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  meetingStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  // Transactions styles
  transactionsList: {
    gap: spacing.sm,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.xs,
  },
  transactionDate: {
    fontSize: typography.fontSize.xs,
  },
  transactionAmount: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },
  // Chama rules styles
  rulesList: {
    gap: spacing.md,
  },
  ruleItem: {
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 8,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ruleNumber: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
    minWidth: 24,
  },
  ruleTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    flex: 1,
  },
  ruleDescription: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
    marginLeft: 32,
  },
  rulePenalty: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    marginTop: spacing.xs,
    marginLeft: 32,
    fontStyle: 'italic',
  },
  defaultRules: {
    marginTop: spacing.sm,
  },
  defaultRulesTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    marginBottom: spacing.md,
  },
  rulesSubtitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  meetingDescription: {
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs,
  },
  // Polls styles
  pollsList: {
    gap: spacing.md,
  },
  pollItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  pollIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  pollInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  pollTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    lineHeight: 18,
  },
  pollDescription: {
    fontSize: typography.fontSize.xs,
    lineHeight: 16,
  },
  pollMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  pollDate: {
    fontSize: typography.fontSize.xs,
  },
  pollDeadline: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  pollStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  pollVotes: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  votedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  votedText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
  },
  pollActions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pollStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  pollStatusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    textTransform: 'capitalize',
  },
  voteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
  },
  voteButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  // New polls notification styles
  newPollsNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  newPollsText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    flex: 1,
  },
  newPollsItem: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  // Chat button styles
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  chatButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
  },
  // Avatar Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(2px)', // reduced from 4px to 2px iOS blur effect - minimal blur for better visibility
  },
  modalContent: {
    width: '92%', // Increased from 85% to 92%
    maxWidth: 420, // Increased from 380 to 420
    marginHorizontal: spacing.sm, // Reduced margin
  },
  avatarCard: {
    padding: 0, // Remove all padding for frameless design
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden', // Ensure image touches edges
  },
  avatarModalName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: spacing.sm,
    borderWidth: 1,
  },
  framelessAvatarContainer: {
    width: '100%',
    alignItems: 'center',
  },
  framelessAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 20, // Only top corners rounded to match card
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0, // No bottom rounding for frameless effect
    borderBottomRightRadius: 0,
  },
  avatarInfoSection: {
    padding: spacing.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  enlargedAvatarText: {
    fontWeight: typography.fontWeight.bold,
  },
  avatarModalEmail: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // Category Badge Styles
  categoryBadge: {
    alignSelf: 'flex-start', // Remove absolute positioning
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    maxWidth: 80, // Limit width to prevent overlap
  },
  categoryBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  // Description Container Styles
  descriptionContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  descriptionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  horizontalSeparator: {
    height: 1,
    marginVertical: spacing.xs,
  },
});

export default getResponsiveStyles;