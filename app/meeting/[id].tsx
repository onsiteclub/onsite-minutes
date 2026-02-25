import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { colors, spacing, fontSize } from "../../lib/theme";
import {
  requestPermissions,
  startSession,
  stopSession,
  getElapsedTime,
} from "../../lib/audio";
import {
  getMeetingParticipants,
  updateMeetingStatus,
  updateMeetingMinutes,
} from "../../lib/database";
import { generateMinutes } from "../../lib/api";
import { generatePdf } from "../../lib/pdf";
import type { AudioChunk, MinutesData } from "../../lib/types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function MeetingRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleStart() {
    const granted = await requestPermissions();
    if (!granted) {
      Alert.alert(
        "Permissão necessária",
        "Precisamos acessar o microfone para gravar a reunião."
      );
      return;
    }

    try {
      await startSession(id!, (updatedChunks) => {
        setChunks([...updatedChunks]);
      });
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsed(getElapsedTime());
      }, 1000);
    } catch (error: any) {
      Alert.alert("Erro", `Não foi possível iniciar a gravação:\n${error?.message || error}`);
      console.error("Recording error:", error);
    }
  }

  async function handleStop() {
    Alert.alert("Fim da reunião", "Deseja encerrar a gravação e gerar a ata?", [
      { text: "Continuar Gravando", style: "cancel" },
      {
        text: "Encerrar",
        style: "destructive",
        onPress: async () => {
          setIsRecording(false);
          setIsProcessing(true);
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          try {
            // 1. Para gravação e transcreve tudo
            setProcessStep("Transcrevendo áudio...");
            const fullText = await stopSession();

            if (!fullText.trim()) {
              Alert.alert("Erro", "Não foi possível transcrever o áudio.");
              setIsProcessing(false);
              return;
            }

            // 2. Busca participantes
            const participants = await getMeetingParticipants(id!);
            const attendees = participants.map((p) => p.name);

            // 3. Gera ata com GPT-4o
            setProcessStep("Gerando ata com IA...");
            await updateMeetingStatus(id!, "processing");

            const minutes: MinutesData = await generateMinutes(
              fullText,
              attendees,
              new Date().toLocaleDateString("pt-BR")
            );

            // 4. Gera PDF
            setProcessStep("Gerando PDF...");
            const pdfPath = await generatePdf(minutes, id!);

            // 5. Salva no banco
            await updateMeetingMinutes(
              id!,
              minutes.title,
              JSON.stringify(minutes),
              pdfPath
            );

            // 6. Notificação
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "Ata pronta!",
                body: `${minutes.title} — Deseja enviar aos participantes?`,
              },
              trigger: null,
            });

            setIsProcessing(false);
            router.replace(`/meeting/result/${id}`);
          } catch (error) {
            console.error("Erro no processamento:", error);
            Alert.alert(
              "Erro",
              "Ocorreu um erro ao processar a reunião. Tente novamente."
            );
            setIsProcessing(false);
          }
        },
      },
    ]);
  }

  function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
  }

  function getChunkStatus(chunk: AudioChunk) {
    switch (chunk.status) {
      case "recording":
        return { icon: "🔴", label: "Gravando" };
      case "uploading":
        return { icon: "⏳", label: "Transcrevendo" };
      case "transcribed":
        return { icon: "✅", label: "Pronto" };
    }
  }

  if (isProcessing) {
    return (
      <View style={styles.container}>
        <View style={styles.processingContainer}>
          <Text style={styles.processingIcon}>⚙️</Text>
          <Text style={styles.processingTitle}>Processando</Text>
          <Text style={styles.processingStep}>{processStep}</Text>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isRecording ? (
        <View style={styles.startContainer}>
          <Text style={styles.startIcon}>🎙</Text>
          <Text style={styles.startTitle}>Pronto para gravar</Text>
          <Text style={styles.startSubtitle}>
            O áudio será salvo em blocos de 15 minutos e transcrito automaticamente
          </Text>
          <TouchableOpacity style={styles.startButton} onPress={handleStart}>
            <Text style={styles.startButtonText}>Iniciar Gravação</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.recordingContainer}>
          {/* Timer */}
          <View style={styles.timerContainer}>
            <View style={styles.recordingDot} />
            <Text style={styles.timer}>{formatTime(elapsed)}</Text>
          </View>

          {/* Chunk counter */}
          <Text style={styles.chunkLabel}>
            Bloco {chunks.length > 0 ? chunks.length : 1}
          </Text>

          {/* Chunks status */}
          {chunks.length > 0 && (
            <View style={styles.chunksContainer}>
              <Text style={styles.chunksTitle}>Blocos de Áudio</Text>
              {chunks.map((chunk) => {
                const status = getChunkStatus(chunk);
                return (
                  <View key={chunk.id} style={styles.chunkRow}>
                    <Text style={styles.chunkIcon}>{status.icon}</Text>
                    <Text style={styles.chunkName}>
                      Bloco {chunk.chunk_number}
                    </Text>
                    <Text style={styles.chunkStatusText}>{status.label}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Stop button */}
          <TouchableOpacity style={styles.stopButton} onPress={handleStop}>
            <Text style={styles.stopIcon}>⏹</Text>
            <Text style={styles.stopText}>Fim da Reunião</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  // Start state
  startContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  startIcon: {
    fontSize: 80,
    marginBottom: spacing.lg,
  },
  startTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.light,
    marginBottom: spacing.sm,
  },
  startSubtitle: {
    fontSize: fontSize.sm,
    color: colors.gray,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: colors.orange,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 16,
  },
  startButtonText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.white,
  },
  // Recording state
  recordingContainer: {
    padding: spacing.lg,
    alignItems: "center",
    paddingTop: spacing.xxl,
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.red,
    marginRight: spacing.sm,
  },
  timer: {
    fontSize: 56,
    fontWeight: "200",
    color: colors.light,
    fontVariant: ["tabular-nums"],
  },
  chunkLabel: {
    fontSize: fontSize.md,
    color: colors.grayLight,
    marginBottom: spacing.xl,
  },
  // Chunks
  chunksContainer: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  chunksTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.grayLight,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chunkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  chunkIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
  },
  chunkName: {
    fontSize: fontSize.md,
    color: colors.light,
    flex: 1,
  },
  chunkStatusText: {
    fontSize: fontSize.sm,
    color: colors.gray,
  },
  // Stop button
  stopButton: {
    backgroundColor: colors.red,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 16,
    gap: spacing.sm,
  },
  stopIcon: {
    fontSize: 24,
  },
  stopText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.white,
  },
  // Processing
  processingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  processingIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  processingTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.light,
    marginBottom: spacing.sm,
  },
  processingStep: {
    fontSize: fontSize.md,
    color: colors.grayLight,
    marginBottom: spacing.lg,
  },
  progressBar: {
    width: "80%",
    height: 4,
    backgroundColor: colors.cardBorder,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    width: "60%",
    height: "100%",
    backgroundColor: colors.orange,
    borderRadius: 2,
  },
});
