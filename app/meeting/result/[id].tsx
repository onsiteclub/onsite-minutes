import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Share,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as MailComposer from "expo-mail-composer";
import { colors, spacing, fontSize } from "../../../lib/theme";
import { getMeeting, getMeetingParticipants } from "../../../lib/database";
import type { MinutesData, Contact } from "../../../lib/types";

export default function MeetingResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [minutes, setMinutes] = useState<MinutesData | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [participants, setParticipants] = useState<
    (Contact & { sent_at: number | null })[]
  >([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const meeting = await getMeeting(id!);
    if (!meeting || !meeting.minutes_json) return;

    setMinutes(JSON.parse(meeting.minutes_json));
    setPdfPath(meeting.pdf_path);

    const parts = await getMeetingParticipants(id!);
    setParticipants(parts);
  }

  async function handleEmailParticipant(contact: Contact) {
    if (!minutes || !pdfPath) return;

    const available = await MailComposer.isAvailableAsync();
    if (!available) {
      Alert.alert("Erro", "Nenhum app de email configurado neste dispositivo.");
      return;
    }

    await MailComposer.composeAsync({
      recipients: [contact.email],
      subject: `Ata de Reunião: ${minutes.title}`,
      body: `Olá ${contact.name},\n\nSegue em anexo a ata da reunião "${minutes.title}".\n\nAtenciosamente,\nOnSite Minutes`,
      attachments: [pdfPath],
    });
  }

  async function handleEmailAll() {
    if (!minutes || !pdfPath) return;

    const emails = participants.filter((p) => p.email).map((p) => p.email);
    if (emails.length === 0) {
      Alert.alert("Sem destinatários", "Nenhum participante tem email cadastrado.");
      return;
    }

    const available = await MailComposer.isAvailableAsync();
    if (!available) {
      Alert.alert("Erro", "Nenhum app de email configurado neste dispositivo.");
      return;
    }

    await MailComposer.composeAsync({
      recipients: emails,
      subject: `Ata de Reunião: ${minutes.title}`,
      body: `Olá,\n\nSegue em anexo a ata da reunião "${minutes.title}".\n\nAtenciosamente,\nOnSite Minutes`,
      attachments: [pdfPath],
    });
  }

  async function handleSharePdf() {
    if (!pdfPath) return;
    try {
      await Share.share({
        url: pdfPath,
        title: minutes?.title || "Ata da Reunião",
      });
    } catch {
      // user cancelled
    }
  }

  if (!minutes) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>{minutes.title}</Text>
      <Text style={styles.date}>{minutes.date}</Text>

      {/* Participantes */}
      <View style={styles.attendees}>
        {minutes.attendees.map((name, i) => (
          <View key={i} style={styles.attendeeBadge}>
            <Text style={styles.attendeeText}>{name}</Text>
          </View>
        ))}
      </View>

      {/* Seções da ata */}
      {minutes.summary.length > 0 && (
        <Section title="Resumo" items={minutes.summary} />
      )}
      {minutes.decisions.length > 0 && (
        <Section title="Decisões" items={minutes.decisions} />
      )}
      {minutes.action_items.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ações</Text>
          {minutes.action_items.map((item, i) => (
            <View key={i} style={styles.actionItem}>
              <Text style={styles.actionTask}>{item.task}</Text>
              <View style={styles.actionMeta}>
                <Text style={styles.actionOwner}>{item.owner}</Text>
                {item.due && <Text style={styles.actionDue}>{item.due}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}
      {minutes.risks.length > 0 && (
        <Section title="Riscos" items={minutes.risks} />
      )}
      {minutes.next_steps.length > 0 && (
        <Section title="Próximos Passos" items={minutes.next_steps} />
      )}

      {/* Ações */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSharePdf}>
          <Text style={styles.primaryBtnText}>Compartilhar PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailAll}>
          <Text style={styles.primaryBtnText}>Enviar por Email</Text>
        </TouchableOpacity>
      </View>

      {/* Participantes */}
      {participants.length > 0 && (
        <View style={styles.sendSection}>
          <Text style={styles.sendTitle}>Participantes</Text>

          {participants.map((p) => (
            <View key={p.id} style={styles.participantRow}>
              <View style={styles.participantInfo}>
                <Text style={styles.participantName}>{p.name}</Text>
                <Text style={styles.participantEmail}>
                  {p.email || "Sem email"}
                </Text>
              </View>
              {p.email && (
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={() => handleEmailParticipant(p)}
                >
                  <Text style={styles.sendBtnText}>Email</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletRow}>
          <Text style={styles.bullet}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  loading: {
    color: colors.gray,
    fontSize: fontSize.md,
    textAlign: "center",
    marginTop: spacing.xxl,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: colors.orange,
    marginBottom: spacing.xs,
  },
  date: {
    fontSize: fontSize.sm,
    color: colors.gray,
    marginBottom: spacing.md,
  },
  attendees: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  attendeeBadge: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  attendeeText: {
    fontSize: fontSize.sm,
    color: colors.light,
  },
  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.light,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
    paddingLeft: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: spacing.xs,
    paddingLeft: spacing.sm,
  },
  bullet: {
    color: colors.orange,
    fontSize: fontSize.md,
    marginRight: spacing.sm,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.grayLight,
    lineHeight: 22,
  },
  // Action items
  actionItem: {
    backgroundColor: colors.card,
    borderLeftWidth: 3,
    borderLeftColor: colors.orange,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionTask: {
    fontSize: fontSize.sm,
    color: colors.light,
    marginBottom: spacing.xs,
  },
  actionMeta: {
    flexDirection: "row",
    gap: spacing.md,
  },
  actionOwner: {
    fontSize: fontSize.xs,
    color: colors.orange,
    fontWeight: "600",
  },
  actionDue: {
    fontSize: fontSize.xs,
    color: colors.gray,
  },
  // Actions
  actions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: fontSize.md,
    color: colors.white,
    fontWeight: "700",
  },
  // Send section
  sendSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  sendTitle: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.light,
    marginBottom: spacing.md,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: fontSize.md,
    color: colors.light,
    fontWeight: "600",
  },
  participantEmail: {
    fontSize: fontSize.xs,
    color: colors.gray,
    marginTop: 2,
  },
  sendBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.orange,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  sendBtnText: {
    fontSize: fontSize.sm,
    color: colors.orange,
    fontWeight: "600",
  },
});
