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
import * as FileSystem from "expo-file-system";
import { colors, spacing, fontSize } from "../../../lib/theme";
import { getMeeting, getMeetingParticipants, markParticipantSent } from "../../../lib/database";
import { sendEmail } from "../../../lib/api";
import { getPdfBase64 } from "../../../lib/pdf";
import type { MinutesData, Contact } from "../../../lib/types";

export default function MeetingResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [minutes, setMinutes] = useState<MinutesData | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [participants, setParticipants] = useState<
    (Contact & { sent_at: number | null })[]
  >([]);
  const [sendingId, setSendingId] = useState<string | null>(null);

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

  async function handleSendEmail(contact: Contact & { sent_at: number | null }) {
    if (!minutes || !pdfPath) return;

    setSendingId(contact.id);
    try {
      const pdfBase64 = await getPdfBase64(pdfPath);

      const html = `
        <p>Olá ${contact.name},</p>
        <p>Segue em anexo a ata da reunião <strong>${minutes.title}</strong>.</p>
        <p>Atenciosamente,<br/>OnSite Minutes</p>
      `;

      await sendEmail(
        contact.email,
        contact.name,
        minutes.title,
        html,
        pdfBase64
      );

      await markParticipantSent(id!, contact.id);
      await loadData();

      Alert.alert("Enviado", `Email enviado para ${contact.name}.`);
    } catch (error) {
      console.error(error);
      Alert.alert("Erro", `Não foi possível enviar para ${contact.name}.`);
    } finally {
      setSendingId(null);
    }
  }

  async function handleSendAll() {
    const pending = participants.filter((p) => !p.sent_at && p.email);
    if (pending.length === 0) {
      Alert.alert("Todos enviados", "Todos os participantes já receberam.");
      return;
    }

    Alert.alert(
      "Enviar para todos",
      `Enviar ata para ${pending.length} participante(s)?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            for (const p of pending) {
              await handleSendEmail(p);
            }
          },
        },
      ]
    );
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
        <TouchableOpacity style={styles.shareBtn} onPress={handleSharePdf}>
          <Text style={styles.shareBtnText}>📄 Compartilhar PDF</Text>
        </TouchableOpacity>
      </View>

      {/* Envio por email */}
      <View style={styles.sendSection}>
        <Text style={styles.sendTitle}>Enviar aos Participantes</Text>

        {participants.map((p) => (
          <View key={p.id} style={styles.participantRow}>
            <View style={styles.participantInfo}>
              <Text style={styles.participantName}>{p.name}</Text>
              <Text style={styles.participantEmail}>
                {p.email || "Sem email"}
              </Text>
            </View>
            {p.sent_at ? (
              <View style={styles.sentBadge}>
                <Text style={styles.sentText}>Enviado ✓</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  !p.email && styles.sendBtnDisabled,
                ]}
                disabled={!p.email || sendingId === p.id}
                onPress={() => handleSendEmail(p)}
              >
                <Text style={styles.sendBtnText}>
                  {sendingId === p.id ? "Enviando..." : "Enviar"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {participants.some((p) => !p.sent_at && p.email) && (
          <TouchableOpacity style={styles.sendAllBtn} onPress={handleSendAll}>
            <Text style={styles.sendAllText}>Enviar para Todos</Text>
          </TouchableOpacity>
        )}
      </View>
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
    marginBottom: spacing.lg,
  },
  shareBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
  },
  shareBtnText: {
    fontSize: fontSize.md,
    color: colors.light,
    fontWeight: "600",
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
  sentBadge: {
    backgroundColor: colors.green + "20",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  sentText: {
    fontSize: fontSize.xs,
    color: colors.green,
    fontWeight: "600",
  },
  sendBtn: {
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.gray,
    opacity: 0.5,
  },
  sendBtnText: {
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: "600",
  },
  sendAllBtn: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  sendAllText: {
    fontSize: fontSize.md,
    color: colors.white,
    fontWeight: "700",
  },
});
