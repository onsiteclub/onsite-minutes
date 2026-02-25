import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, spacing, fontSize } from "../../lib/theme";
import {
  getAllContacts,
  getAllMeetings,
  createMeeting,
} from "../../lib/database";
import type { Contact, Meeting } from "../../lib/types";
import ParticipantSelector from "../../components/ParticipantSelector";

export default function HomeScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const [c, m] = await Promise.all([getAllContacts(), getAllMeetings()]);
    setContacts(c);
    setMeetings(m);
  }

  async function handleStartMeeting() {
    if (contacts.length === 0) {
      Alert.alert(
        "Sem contatos",
        "Cadastre pelo menos um participante antes de iniciar.",
        [{ text: "Cadastrar", onPress: () => router.push("/contacts") }]
      );
      return;
    }
    setShowSelector(true);
  }

  async function handleConfirmParticipants() {
    if (selectedIds.length === 0) {
      Alert.alert("Selecione", "Escolha pelo menos um participante.");
      return;
    }
    const meeting = await createMeeting(selectedIds);
    setShowSelector(false);
    setSelectedIds([]);
    router.push(`/meeting/${meeting.id}`);
  }

  function getStatusLabel(status: Meeting["status"]) {
    switch (status) {
      case "recording":
        return { text: "Gravando", color: colors.red };
      case "processing":
        return { text: "Processando", color: colors.orange };
      case "done":
        return { text: "Pronta", color: colors.green };
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>OnSite</Text>
        <Text style={styles.logoSub}>Minutes</Text>
      </View>

      <TouchableOpacity style={styles.bigButton} onPress={handleStartMeeting}>
        <Text style={styles.bigButtonIcon}>🎙</Text>
        <Text style={styles.bigButtonText}>Nova Reunião</Text>
      </TouchableOpacity>

      {meetings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reuniões Recentes</Text>
          <FlatList
            data={meetings.slice(0, 5)}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const status = getStatusLabel(item.status);
              return (
                <TouchableOpacity
                  style={styles.meetingCard}
                  onPress={() => {
                    if (item.status === "done") {
                      router.push(`/meeting/result/${item.id}`);
                    } else if (item.status === "recording") {
                      router.push(`/meeting/${item.id}`);
                    }
                  }}
                >
                  <View style={styles.meetingInfo}>
                    <Text style={styles.meetingTitle}>
                      {item.title || "Reunião"}
                    </Text>
                    <Text style={styles.meetingDate}>{item.date}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: status.color + "20" },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: status.color }]}>
                      {status.text}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      {showSelector && (
        <ParticipantSelector
          contacts={contacts}
          selectedIds={selectedIds}
          onToggle={(id) =>
            setSelectedIds((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onConfirm={handleConfirmParticipants}
          onCancel={() => {
            setShowSelector(false);
            setSelectedIds([]);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  logo: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    color: colors.orange,
  },
  logoSub: {
    fontSize: fontSize.lg,
    fontWeight: "300",
    color: colors.grayLight,
    marginTop: -4,
  },
  bigButton: {
    backgroundColor: colors.orange,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  bigButtonIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  bigButtonText: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.white,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.grayLight,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  meetingCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meetingInfo: {
    flex: 1,
  },
  meetingTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.light,
  },
  meetingDate: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});
