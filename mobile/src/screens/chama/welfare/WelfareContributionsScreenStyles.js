import { StyleSheet } from "react-native";
import { spacing, typography, borderRadius, shadows } from "../../../utils/theme";

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1, padding: spacing.sm },
  header: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  headerContent: { flexDirection: "row", alignItems: "center" },
  requestIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.lg,
  },
  requestInfo: { flex: 1 },
  requestTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  requestAmount: { fontSize: typography.fontSize.sm },
  sectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.lg,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.sm,
    marginBottom: spacing.xl,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderTopWidth: 1,
    marginTop: spacing.sm,
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  paginationButtonDisabled: { opacity: 0.5 },
  paginationInfo: {
    fontSize: typography.fontSize.sm,
    color: "#6b7280",
    fontWeight: typography.fontWeight.medium,
    minWidth: 60,
    textAlign: "center",
  },
});

export default styles;
