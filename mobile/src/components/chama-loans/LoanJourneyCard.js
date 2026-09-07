import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../common/Card';
import { spacing, typography, borderRadius } from '../../utils/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ------------------------------------------------------------------ *
 *  Journey model — derived purely from the loan's live state.
 * ------------------------------------------------------------------ */

const fmtDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtMoney = (n) => {
  const v = Number(n);
  if (!isFinite(v)) return 'KES 0';
  return `KES ${v.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
};

const POST_DISBURSE = ['disbursed', 'active', 'delinquent', 'partial', 'recovery_active', 'defaulted', 'completed', 'closed', 'written_off'];

function buildJourney(loan, disbursement, guarantorList = [], refereeList = []) {
  if (!loan) return { steps: [], doneCount: 0, currentIndex: -1, rejected: false };

  const status = String(loan.status || '').toLowerCase();
  const stage = String(loan.approvalStage || '').toLowerCase();

  // Actual records attached to THIS loan take precedence over loan-type config,
  // so a loan keeps its guarantor/referee step for history even if the product
  // was later changed to not require them.
  const gCount = Array.isArray(guarantorList) ? guarantorList.length : 0;
  const rCount = Array.isArray(refereeList) ? refereeList.length : 0;
  const gAcceptedActual = (guarantorList || []).filter((g) => String(g.status).toLowerCase() === 'accepted').length;
  const rAcceptedActual = (refereeList || []).filter((r) => String(r.status).toLowerCase() === 'accepted').length;

  const reqG = Math.max(Number(loan.requiredGuarantors ?? 0), gCount);
  const accG = Math.max(Number(loan.approvedGuarantors ?? 0), gAcceptedActual);
  const reqR = Math.max(Number(loan.requiredReferees ?? 0), rCount);
  const accR = Math.max(Number(loan.approvedReferees ?? 0), rAcceptedActual);

  // Show the backers step only when this loan actually has / needs them.
  const needsBackers = reqG + reqR > 0 || gCount + rCount > 0;
  const backersAllIn = accG >= reqG && accR >= reqR;
  const backersDeclined = stage === 'guarantors_declined' ||
    (guarantorList || []).concat(refereeList || []).some((b) => ['declined', 'rejected'].includes(String(b.status).toLowerCase()));

  const disbursed = !!loan.disbursedAt || POST_DISBURSE.includes(status);
  const paid = Number(loan.paidAmount ?? 0);
  const total = Number(loan.totalAmount ?? loan.amount ?? 0);

  const steps = [];

  steps.push({
    key: 'applied',
    label: 'Applied',
    icon: 'document-text',
    done: true,
    sub: `${fmtDate(loan.createdAt)} · ${fmtMoney(loan.amount)}`.replace(/^ · /, ''),
  });

  if (needsBackers) {
    const hasG = reqG > 0;
    const hasR = reqR > 0;
    const label = hasG && hasR ? 'Guarantors & Referees' : hasR ? 'Referees' : 'Guarantors';
    const done = backersAllIn || ['guarantors_approved', 'secretary_approved', 'treasurer_approved', 'fully_approved', 'approved'].includes(stage) || disbursed;
    const parts = [];
    if (hasG) parts.push(`${accG}/${reqG} guarantors`);
    if (hasR) parts.push(`${accR}/${reqR} referees`);
    steps.push({
      key: 'backers',
      label,
      icon: 'people',
      done,
      failed: backersDeclined && !done,
      sub: (backersDeclined && !done)
        ? 'A backer declined — approval is blocked'
        : done
          ? `${parts.join(' · ')} confirmed`
          : `Waiting to accept — ${parts.join(' · ')}`,
    });
  }

  const secDone = !!loan.secretaryApprovedAt || ['secretary_approved', 'treasurer_approved', 'fully_approved', 'approved'].includes(stage) || disbursed;
  steps.push({
    key: 'secretary',
    label: 'Secretary Review',
    icon: 'shield-checkmark',
    done: secDone,
    sub: secDone ? (loan.secretaryApprovedAt ? `Approved ${fmtDate(loan.secretaryApprovedAt)}` : 'Approved') : 'Awaiting the secretary’s OTP approval',
  });

  const treDone = !!loan.treasurerApprovedAt || ['treasurer_approved', 'fully_approved', 'approved'].includes(stage) || disbursed;
  steps.push({
    key: 'treasurer',
    label: 'Treasurer Review',
    icon: 'shield-checkmark',
    done: treDone,
    sub: treDone ? (loan.treasurerApprovedAt ? `Approved ${fmtDate(loan.treasurerApprovedAt)}` : 'Approved') : 'Awaiting the treasurer’s OTP approval',
  });

  const chairDone = !!loan.chairpersonApprovedAt || stage === 'fully_approved' || status === 'approved' || disbursed;
  steps.push({
    key: 'chair',
    label: 'Chairperson Sign-off',
    icon: 'ribbon',
    done: chairDone,
    sub: chairDone ? (loan.chairpersonApprovedAt ? `Approved ${fmtDate(loan.chairpersonApprovedAt)}` : 'Approved') : 'Awaiting the chairperson’s OTP approval',
  });

  const disbStatus = String(disbursement?.status || '').toLowerCase();
  steps.push({
    key: 'disburse',
    label: 'Disbursed',
    icon: 'cash',
    done: disbursed && disbStatus !== 'failed',
    failed: disbStatus === 'failed',
    sub: disbursed
      ? (disbStatus === 'failed'
          ? 'Disbursement failed — retry needed'
          : `${fmtMoney(disbursement?.amount || loan.amount)} sent via M-Pesa B2C${disbursement?.updatedAt ? ` · ${fmtDate(disbursement.updatedAt)}` : ''}`)
      : (status === 'disbursing' ? 'Sending to the member’s M-Pesa…' : 'Ready for M-Pesa B2C disbursement'),
  });

  if (disbursed) {
    const completed = status === 'completed';
    const defaulted = status === 'defaulted';
    steps.push({
      key: 'repay',
      label: completed ? 'Repaid in Full' : 'Repayment',
      icon: completed ? 'checkmark-done-circle' : 'repeat',
      done: completed,
      failed: defaulted,
      sub: completed
        ? `Cleared ${fmtDate(loan.updatedAt)}`.replace(/ $/, '')
        : defaulted
          ? 'In default — recovery process'
          : `${fmtMoney(paid)} of ${fmtMoney(total)} repaid`,
    });
  }

  // Rejection short-circuits the journey.
  const rejected = status === 'rejected' || !!loan.rejectedAt;
  if (rejected) {
    const firstPending = steps.findIndex((s) => !s.done);
    const insertAt = firstPending === -1 ? steps.length : firstPending;
    steps.splice(insertAt, steps.length - insertAt, {
      key: 'rejected',
      label: 'Rejected',
      icon: 'close-circle',
      failed: true,
      sub: loan.rejectedReason ? `Reason: ${loan.rejectedReason}` : (loan.rejectedAt ? `Rejected ${fmtDate(loan.rejectedAt)}` : 'Application rejected'),
    });
  }

  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = rejected
    ? steps.findIndex((s) => s.failed)
    : steps.findIndex((s) => !s.done && !s.failed);

  return { steps, doneCount, currentIndex, rejected };
}

/* ------------------------------------------------------------------ *
 *  UI
 * ------------------------------------------------------------------ */

const NodeIcon = ({ state, icon, colors }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state !== 'current') return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state, pulse]);

  const color =
    state === 'done' ? colors.success :
    state === 'failed' ? colors.error :
    state === 'current' ? colors.primary :
    colors.textTertiary;

  const size = state === 'current' ? 34 : state === 'pending' ? 22 : 28;

  return (
    <View style={styles.nodeWrap}>
      {state === 'current' && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: color,
              width: size + 16,
              height: size + 16,
              borderRadius: (size + 16) / 2,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.35] }) }],
            },
          ]}
        />
      )}
      <View
        style={[
          styles.node,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: state === 'pending' ? 'transparent' : color,
            borderWidth: state === 'pending' ? 2 : 0,
            borderColor: colors.border,
          },
        ]}
      >
        {state === 'done' && <Ionicons name="checkmark" size={16} color={colors.white} />}
        {state === 'failed' && <Ionicons name="close" size={16} color={colors.white} />}
        {state === 'current' && <Ionicons name={icon} size={17} color={colors.white} />}
      </View>
    </View>
  );
};

const LoanJourneyCard = ({ loan, disbursement, guarantors, referees, colors, defaultCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const { steps, doneCount, currentIndex, rejected } = useMemo(
    () => buildJourney(loan, disbursement, guarantors, referees),
    [loan, disbursement, guarantors, referees]
  );

  if (!steps.length) return null;

  const total = steps.length;
  const progress = rejected ? doneCount / total : Math.min(1, (doneCount + (currentIndex >= 0 ? 0.5 : 0)) / total);
  const pct = Math.round((doneCount / total) * 100);

  const headline = rejected
    ? 'Application rejected'
    : currentIndex === -1
      ? 'Journey complete'
      : `Now at: ${steps[currentIndex]?.label}`;

  const accent = rejected ? colors.error : currentIndex === -1 ? colors.success : colors.primary;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
    setCollapsed((v) => !v);
  };

  return (
    <Card variant="outlined" margin="none" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header — tap anywhere to collapse / expand */}
      <TouchableOpacity activeOpacity={0.7} onPress={toggle} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: colors.textSecondary }]}>LOAN JOURNEY</Text>
          <Text style={[styles.headline, { color: accent }]} numberOfLines={1}>{headline}</Text>
        </View>
        <View style={[styles.pctBadge, { borderColor: accent }]}>
          <Text style={[styles.pctText, { color: accent }]}>{pct}%</Text>
        </View>
        <Ionicons
          name={collapsed ? 'chevron-down' : 'chevron-up'}
          size={18}
          color={colors.textSecondary}
          style={{ marginLeft: spacing.xs, marginTop: 2 }}
        />
      </TouchableOpacity>

      {/* Progress rail — always visible, even when collapsed */}
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: accent }]} />
      </View>
      <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>
        {collapsed
          ? `${doneCount}/${total} steps · tap to expand`
          : `${doneCount} of ${total} steps complete`}
      </Text>

      {collapsed && currentIndex >= 0 && steps[currentIndex]?.sub ? (
        <Text style={[styles.collapsedSub, { color: colors.textSecondary }]} numberOfLines={2}>
          {steps[currentIndex].sub}
        </Text>
      ) : null}

      {/* Timeline */}
      {!collapsed && (
      <View style={styles.timeline}>
        {steps.map((s, i) => {
          const state = s.failed ? 'failed' : s.done ? 'done' : i === currentIndex ? 'current' : 'pending';
          const isLast = i === steps.length - 1;
          const railColor = state === 'done' ? colors.success : state === 'failed' ? colors.error : colors.border;
          return (
            <View key={s.key} style={styles.row}>
              <View style={styles.railCol}>
                <NodeIcon state={state} icon={s.icon} colors={colors} />
                {!isLast && (
                  <View
                    style={[
                      styles.rail,
                      {
                        backgroundColor: railColor,
                        opacity: state === 'pending' ? 0.5 : 1,
                        ...(state === 'pending' ? { borderStyle: 'dashed', borderLeftWidth: 2, borderLeftColor: colors.border, backgroundColor: 'transparent', width: 0 } : {}),
                      },
                    ]}
                  />
                )}
              </View>

              <View style={[styles.body, isLast && { paddingBottom: 0 }]}>
                <View style={styles.rowTop}>
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: state === 'pending' ? colors.textTertiary : colors.text,
                        fontWeight: state === 'current' ? typography.fontWeight.bold : typography.fontWeight.semibold,
                      },
                    ]}
                  >
                    {s.label}
                  </Text>
                  {state === 'current' && (
                    <View style={[styles.statusPill, { backgroundColor: colors.primary + '1F' }]}>
                      <Ionicons name="sync" size={10} color={colors.primary} />
                      <Text style={[styles.statusPillText, { color: colors.primary }]}>IN PROGRESS</Text>
                    </View>
                  )}
                  {state === 'done' && (
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} style={{ marginLeft: spacing.xs }} />
                  )}
                  {state === 'failed' && (
                    <View style={[styles.statusPill, { backgroundColor: colors.error + '1F' }]}>
                      <Text style={[styles.statusPillText, { color: colors.error }]}>STOPPED</Text>
                    </View>
                  )}
                </View>
                {!!s.sub && (
                  <Text style={[styles.stepSub, { color: state === 'pending' ? colors.textTertiary : colors.textSecondary }]}>
                    {s.sub}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: spacing.md, marginTop: spacing.xs, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  kicker: { fontSize: 10, fontWeight: typography.fontWeight.bold, letterSpacing: 1.2 },
  headline: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.bold, marginTop: 2 },
  pctBadge: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 3, marginLeft: spacing.sm },
  pctText: { fontSize: 11, fontWeight: typography.fontWeight.bold },

  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 10, marginTop: 5, marginBottom: spacing.sm, fontWeight: typography.fontWeight.medium },
  collapsedSub: { fontSize: typography.fontSize.xs, marginTop: -2, marginBottom: spacing.xs, lineHeight: 15 },

  timeline: { marginTop: spacing.xs },
  row: { flexDirection: 'row' },
  railCol: { width: 40, alignItems: 'center' },
  nodeWrap: { alignItems: 'center', justifyContent: 'center', height: 38 },
  pulseRing: { position: 'absolute', borderWidth: 2 },
  node: { alignItems: 'center', justifyContent: 'center' },
  rail: { width: 2, flex: 1, marginVertical: 2, minHeight: 18, borderRadius: 1 },

  body: { flex: 1, paddingBottom: spacing.md, paddingTop: 6, paddingLeft: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  stepLabel: { fontSize: typography.fontSize.sm },
  stepSub: { fontSize: typography.fontSize.xs, marginTop: 3, lineHeight: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  statusPillText: { fontSize: 9, fontWeight: typography.fontWeight.bold, letterSpacing: 0.5 },
});

export default LoanJourneyCard;
