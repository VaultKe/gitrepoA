import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../../context/AppContext';
import { getThemeColors, spacing, typography, borderRadius } from '../../../utils/theme';
import ApiService from '../../../services/api';
import { getMemberName, getMemberEmail } from '../../../utils/pollsVotingHelpers';

const POLL_TYPES = [
  { value: 'general', label: 'General poll', icon: 'chatbubbles-outline', desc: 'Opinions and everyday decisions' },
  { value: 'financial_decision', label: 'Financial decision', icon: 'cash-outline', desc: 'Money matters that need approval' },
  { value: 'Election / Voting', label: 'Role change', icon: 'people-outline', desc: 'Elect a member into a role', chairOnly: true },
];

const DURATIONS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '30 days', days: 30 },
];

const ROLES = ['chairperson', 'treasurer', 'secretary'];

const CreatePollScreen = ({ route, navigation }) => {
  const { theme, user } = useApp();
  const colors = getThemeColors(theme);
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { chamaId } = route.params || {};

  const [type, setType] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [durationDays, setDurationDays] = useState(7);
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [requiresMajority, setRequiresMajority] = useState(true);

  const [requestedRole, setRequestedRole] = useState('chairperson');
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState([]);
  const [candidates, setCandidates] = useState([]); // full member objects

  const [userRole, setUserRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);

  const isRole = type === 'Election / Voting';
  const canPickRole = userRole === 'chairperson';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const meId = user?.id;
        const [roleRes, memRes] = await Promise.all([
          meId ? ApiService.getMemberRole(chamaId, meId).catch(() => null) : Promise.resolve(null),
          ApiService.getChamaMembers(chamaId).catch(() => null),
        ]);
        if (!alive) return;
        if (roleRes?.success) setUserRole((roleRes.data?.role || 'member').toLowerCase());
        if (memRes?.success) setMembers(Array.isArray(memRes.data) ? memRes.data : []);
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, [chamaId, user?.id]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const chosen = new Set(candidates.map((c) => c.user_id || c.userId || c.id));
    return (members || [])
      .filter((m) => {
        const id = m.user_id || m.userId || m.id;
        if (chosen.has(id)) return false;
        if (!q) return true;
        return (
          getMemberName(m).toLowerCase().includes(q) ||
          getMemberEmail(m).toLowerCase().includes(q) ||
          String(m.role || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 6);
  }, [members, memberQuery, candidates]);

  const setOption = (i, v) => setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => setOptions((prev) => (prev.length < 10 ? [...prev, ''] : prev));
  const removeOption = (i) => setOptions((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev));

  const addCandidate = (m) => setCandidates((prev) => [...prev, m]);
  const removeCandidate = (id) =>
    setCandidates((prev) => prev.filter((c) => (c.user_id || c.userId || c.id) !== id));

  const validate = () => {
    if (isRole) {
      if (!canPickRole) return 'Only the chairperson can start a role change poll.';
      if (candidates.length < 1) return 'Add at least one candidate.';
      return null;
    }
    if (!title.trim()) return 'Give the poll a title.';
    const filled = options.map((o) => o.trim()).filter(Boolean);
    if (filled.length < 2) return 'Add at least two options.';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Check the form', err);
      return;
    }
    setSubmitting(true);
    try {
      const endDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
      let res;

      if (isRole) {
        const names = candidates.map((c) => getMemberName(c)).join(', ');
        res = await ApiService.createPoll(chamaId, {
          title: `${requestedRole.charAt(0).toUpperCase() + requestedRole.slice(1)} Election`,
          description: `Election for ${requestedRole}. Candidate(s): ${names}`,
          type: 'Election / Voting',
          ends_at: endDate,
          options: candidates.map((c) => ({
            option_text: getMemberName(c),
            candidateId: c.user_id || c.userId || c.id,
            candidateInfo: c,
          })),
          isAnonymous,
          requiresMajority,
          majorityPercentage: 50,
          requestedRole,
          justification: `Election for ${requestedRole} with ${candidates.length} candidate(s)`,
        });
      } else {
        res = await ApiService.createRegularPoll(chamaId, {
          title: title.trim(),
          description: description.trim(),
          type,
          ends_at: endDate,
          isAnonymous,
          requiresMajority,
          majorityPercentage: 50,
          options: options.map((o) => o.trim()).filter(Boolean).map((o) => ({ option_text: o })),
        });
      }

      if (res?.success) {
        if (navigation.canGoBack()) navigation.goBack();
        else navigation.navigate('PollsVotingScreen', { chamaId });
      } else {
        Alert.alert('Could not create poll', res?.error || 'Please try again.');
      }
    } catch (e) {
      Alert.alert('Could not create poll', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Poll type */}
        <Text style={s.sectionLabel}>Poll type</Text>
        <View style={{ gap: spacing.sm }}>
          {POLL_TYPES.map((t) => {
            const selected = type === t.value;
            const locked = t.chairOnly && !canPickRole;
            return (
              <TouchableOpacity
                key={t.value}
                activeOpacity={0.8}
                disabled={locked}
                onPress={() => setType(t.value)}
                style={[
                  s.typeCard,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '12' : colors.surface },
                  locked && { opacity: 0.45 },
                ]}
              >
                <View style={[s.typeIcon, { backgroundColor: (selected ? colors.primary : colors.textSecondary) + '1A' }]}>
                  <Ionicons name={t.icon} size={18} color={selected ? colors.primary : colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.typeLabel, { color: colors.text }]}>{t.label}</Text>
                  <Text style={[s.typeDesc, { color: colors.textSecondary }]}>
                    {locked ? 'Chairperson only' : t.desc}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? colors.primary : colors.textTertiary}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Regular poll: title + description + options */}
        {!isRole && (
          <>
            <Text style={s.sectionLabel}>Title</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What are members deciding on?"
              placeholderTextColor={colors.textTertiary}
              maxLength={140}
            />

            <Text style={s.sectionLabel}>Description (optional)</Text>
            <TextInput
              style={[s.input, s.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add context to help members decide"
              placeholderTextColor={colors.textTertiary}
              multiline
            />

            <Text style={s.sectionLabel}>Options</Text>
            <View style={{ gap: spacing.sm }}>
              {options.map((opt, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    value={opt}
                    onChangeText={(v) => setOption(i, v)}
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor={colors.textTertiary}
                  />
                  {options.length > 2 && (
                    <TouchableOpacity onPress={() => removeOption(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            {options.length < 10 && (
              <TouchableOpacity style={[s.addBtn, { borderColor: colors.primary }]} onPress={addOption}>
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={[s.addBtnText, { color: colors.primary }]}>Add option</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Role change: role + candidates */}
        {isRole && (
          <>
            <Text style={s.sectionLabel}>Role to fill</Text>
            <View style={s.chipRow}>
              {ROLES.map((r) => {
                const selected = requestedRole === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRequestedRole(r)}
                    style={[
                      s.chip,
                      { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface },
                    ]}
                  >
                    <Text style={{ color: selected ? colors.white : colors.text, fontSize: 13, textTransform: 'capitalize', fontWeight: typography.fontWeight.medium }}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.sectionLabel}>Candidates</Text>
            <TextInput
              style={s.input}
              value={memberQuery}
              onChangeText={setMemberQuery}
              placeholder="Search members by name or email"
              placeholderTextColor={colors.textTertiary}
            />
            {!!memberQuery && filteredMembers.length > 0 && (
              <View style={[s.searchResults, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                {filteredMembers.map((m) => (
                  <TouchableOpacity
                    key={m.user_id || m.userId || m.id}
                    style={[s.searchRow, { borderBottomColor: colors.border }]}
                    onPress={() => { addCandidate(m); setMemberQuery(''); }}
                  >
                    <Text style={{ color: colors.text, fontWeight: typography.fontWeight.medium }}>{getMemberName(m)}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {(m.role || 'member')} · {getMemberEmail(m)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {candidates.length > 0 && (
              <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                {candidates.map((c) => {
                  const id = c.user_id || c.userId || c.id;
                  return (
                    <View key={id} style={[s.candidate, { borderColor: colors.primary, backgroundColor: colors.primary + '12' }]}>
                      <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                        {getMemberName(c)} · {c.role || 'member'}
                      </Text>
                      <TouchableOpacity onPress={() => removeCandidate(id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={20} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Duration */}
        <Text style={s.sectionLabel}>Voting closes in</Text>
        <View style={s.chipRow}>
          {DURATIONS.map((d) => {
            const selected = durationDays === d.days;
            return (
              <TouchableOpacity
                key={d.days}
                onPress={() => setDurationDays(d.days)}
                style={[
                  s.chip,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.surface },
                ]}
              >
                <Text style={{ color: selected ? colors.white : colors.text, fontSize: 13, fontWeight: typography.fontWeight.medium }}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Settings */}
        <View style={[s.settingRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.settingTitle, { color: colors.text }]}>Anonymous voting</Text>
            <Text style={[s.settingDesc, { color: colors.textSecondary }]}>Hide who voted for what</Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={isAnonymous ? colors.primary : colors.textSecondary}
          />
        </View>
        <View style={[s.settingRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.settingTitle, { color: colors.text }]}>Require majority</Text>
            <Text style={[s.settingDesc, { color: colors.textSecondary }]}>Pass only with more than half the votes</Text>
          </View>
          <Switch
            value={requiresMajority}
            onValueChange={setRequiresMajority}
            trackColor={{ false: colors.border, true: colors.primary + '55' }}
            thumbColor={requiresMajority ? colors.primary : colors.textSecondary}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[s.footerBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
          disabled={submitting}
        >
          <Text style={{ color: colors.text, fontWeight: typography.fontWeight.semibold }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.footerBtn, { backgroundColor: colors.primary, flex: 1.4, opacity: submitting ? 0.7 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color={colors.white} />
              <Text style={{ color: colors.white, fontWeight: typography.fontWeight.bold }}>Create poll</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    sectionLabel: {
      fontSize: 13,
      fontWeight: typography.fontWeight.bold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      fontSize: 15,
      marginBottom: spacing.sm,
    },
    textArea: { minHeight: 88, textAlignVertical: 'top' },
    typeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderWidth: 1,
      borderRadius: borderRadius.md,
    },
    typeIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    typeLabel: { fontSize: 15, fontWeight: typography.fontWeight.semibold },
    typeDesc: { fontSize: 12.5, marginTop: 1 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm + 2,
      marginTop: spacing.sm,
    },
    addBtnText: { fontSize: 13, fontWeight: typography.fontWeight.semibold },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
    },
    searchResults: { borderWidth: 1, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.xs },
    searchRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1 },
    candidate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: borderRadius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginTop: spacing.sm,
    },
    settingTitle: { fontSize: 14, fontWeight: typography.fontWeight.semibold },
    settingDesc: { fontSize: 12, marginTop: 1 },
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
    },
    footerBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
    },
  });

export default CreatePollScreen;
