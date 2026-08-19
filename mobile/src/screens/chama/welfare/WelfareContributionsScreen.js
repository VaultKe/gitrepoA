import React from "react";
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../../../context/AppContext";
import { useChamaContext } from "../../../context/ChamaContext";
import { getThemeColors, spacing, typography } from "../../../utils/theme";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import Card from "../../../components/common/Card";
import useWelfareContributionsScreen from "../../../hooks/useWelfareContributionsScreen";
import WelfareContributionRow from "../../../components/welfare/WelfareContributionRow";
import styles from "./WelfareContributionsScreenStyles";

const WelfareContributionsScreen = ({ route, navigation }) => {
  const { theme } = useApp();
  const { currentChamaId } = useChamaContext();
  const colors = getThemeColors(theme);

  const screen = useWelfareContributionsScreen({ route, navigation });

  const {
    welfareRequestId,
    chamaId,
    welfareRequest,
    allContributions,
    requestLoading,
    contributionsLoading,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    anyLoading,
    contributions,
    tableStyles,
    loadWelfareRequestDetails,
    loadContributions,
    formatCurrency,
    formatDate,
    getContributorDisplayName,
    setCurrentPage,
  } = screen;

  if (!welfareRequestId) {
    console.warn(
      "⚠️ WelfareContributionsScreen: welfareRequestId is null — rendering LoadingSpinner",
    );
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // When both the welfare-request query returned nothing for this fund and no
  // contribution records were found, show the "not found" empty state.
  if (!welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.errorState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle case where we have contribution data but no welfare request details yet
  // Show loading state until we can construct the request from contribution data
  if (!welfareRequest && allContributions.length > 0 && anyLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // Handle loading states
  if (anyLoading && !welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // Handle case where we have contribution data but no welfare request details yet
  // Show loading state until we can construct the request from contribution data
  if (!welfareRequest && allContributions.length > 0 && anyLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  // When both the welfare-request query returned nothing for this fund and no
  // contribution records were found, show the "not found" empty state.
  if (!welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.errorState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!welfareRequest && !allContributions.length) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.errorState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (anyLoading && !welfareRequest && allContributions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!welfareRequest && !allContributions.length) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.emptyState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle case where we have contribution data but no welfare request details and not loading
  if (!welfareRequest && allContributions.length > 0 && !anyLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.errorState}>
          <Ionicons
            name="heart-outline"
            size={64}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Welfare Request Not Found
          </Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSecondary }]}>
            Unable to load welfare request details
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.backButtonText, { color: colors.white }]}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.headerContent}>
            <View style={styles.requestIcon}>
              <Ionicons name="heart" size={32} color={colors.primary} />
            </View>
            <View style={styles.requestInfo}>
              <Text
                style={[styles.requestTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                Contributions to{" "}
                {welfareRequest ? welfareRequest.title : "Welfare Fund"}
              </Text>
              <Text style={[styles.requestAmount, { color: colors.success }]}>
                Target: {formatCurrency(welfareRequest ? welfareRequest.amount : 0)}
              </Text>
              <Text
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.textSecondary,
                }}
              >
                {(welfareRequest && welfareRequest.contributionCount) || 0}{" "}
                contributor
                {((welfareRequest && welfareRequest.contributionCount) || 0) !== 1
                  ? "s"
                  : ""}{" "}
                &bull;{" "}
                {formatCurrency(
                  (welfareRequest && welfareRequest.totalContributions) || 0,
                )}{" "}
                raised
              </Text>
            </View>
          </View>
        </View>

        {/* Contribution Details table */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginBottom: spacing.md },
          ]}
        >
          Contribution Details
        </Text>
        <Card variant="outlined" style={{ borderRadius: 8, overflow: "hidden" }}>
          {/* Table header */}
          <View style={tableStyles.tableHeader}>
            <View style={[tableStyles.tableCell, tableStyles.nameCell]}>
              <Text
                style={[tableStyles.tableHeaderText, { textAlign: "left" }]}
              >
                Contributor
              </Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.amountCell]}>
              <Text style={tableStyles.tableHeaderText}>Amount</Text>
            </View>
            <View style={[tableStyles.tableCell, tableStyles.dateCell]}>
              <Text style={tableStyles.tableHeaderText}>Date</Text>
            </View>
          </View>

          {/* Table body */}
          {contributions.length > 0 ? ( // Render rows when we have real data
            contributions.map((contribution, index) => (
              <WelfareContributionRow
                key={contribution.id}
                contribution={contribution}
                index={index}
                colors={colors}
                tableStyles={tableStyles}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                getContributorDisplayName={getContributorDisplayName}
              />
            ))
          ) : (
            /* Empty state – no contribution records yet */
            <View
              style={{ paddingVertical: spacing.xxxl, alignItems: "center" }}
            >
              <Ionicons
                name="wallet-outline"
                size={48}
                color={colors.textTertiary}
              />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: colors.text, marginTop: spacing.md },
                ]}
              >
                No Contributions Yet
              </Text>
              <Text
                style={[
                  styles.emptySubtitle,
                  { color: colors.textSecondary, textAlign: "center" },
                ]}
              >
                Be the first to contribute to this welfare request
              </Text>
            </View>
          )}

          {/* Pagination */}
          {totalItems > pageSize && (
            <View style={[styles.paginationContainer, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === 1 && styles.paginationButtonDisabled,
                ]}
                onPress={() =>
                  currentPage > 1 && setCurrentPage(currentPage - 1)
                }
                disabled={currentPage === 1}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={
                    currentPage === 1 ? colors.textTertiary : colors.primary
                  }
                />
              </TouchableOpacity>

              <Text style={[styles.paginationInfo, { color: colors.text }]}>
                Page {currentPage} of {totalPages} ({totalItems} total)
              </Text>

              <TouchableOpacity
                style={[
                  styles.paginationButton,
                  currentPage === totalPages && styles.paginationButtonDisabled,
                ]}
                onPress={() =>
                  currentPage < totalPages && setCurrentPage(currentPage + 1)
                }
                disabled={currentPage === totalPages}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={
                    currentPage === totalPages
                      ? colors.textTertiary
                      : colors.primary
                  }
                />
              </TouchableOpacity>
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

export default WelfareContributionsScreen;
