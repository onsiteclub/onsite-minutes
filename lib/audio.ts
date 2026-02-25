import { Audio } from "expo-av";
import { File, Paths } from "expo-file-system";
import {
  createAudioChunk,
  updateChunkStatus,
  getChunksForMeeting,
} from "./database";
import { transcribeAudio } from "./api";
import type { AudioChunk } from "./types";

const CHUNK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

export interface RecordingSession {
  meetingId: string;
  currentChunkNumber: number;
  recording: Audio.Recording | null;
  timer: ReturnType<typeof setTimeout> | null;
  startTime: number;
  isPaused: boolean;
  onChunkStatusChange?: (chunks: AudioChunk[]) => void;
}

let session: RecordingSession | null = null;

export async function requestPermissions(): Promise<boolean> {
  const { granted } = await Audio.requestPermissionsAsync();
  if (granted) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
  }
  return granted;
}

export async function startSession(
  meetingId: string,
  onChunkStatusChange?: (chunks: AudioChunk[]) => void
): Promise<void> {
  if (session) {
    throw new Error("Já existe uma sessão de gravação ativa");
  }

  session = {
    meetingId,
    currentChunkNumber: 0,
    recording: null,
    timer: null,
    startTime: Date.now(),
    isPaused: false,
    onChunkStatusChange,
  };

  await startNewChunk();
}

async function startNewChunk(): Promise<void> {
  if (!session) return;

  session.currentChunkNumber++;
  const chunkNumber = session.currentChunkNumber;

  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  session.recording = recording;

  const filePath = `${Paths.document.uri}meeting_${session.meetingId}_chunk_${chunkNumber}.m4a`;

  await createAudioChunk(session.meetingId, chunkNumber, filePath);
  await notifyChunkChange();

  // Timer para auto-split em 15 minutos
  session.timer = setTimeout(async () => {
    if (session && !session.isPaused) {
      await rotateChunk();
    }
  }, CHUNK_DURATION_MS);
}

async function rotateChunk(): Promise<void> {
  if (!session || !session.recording) return;

  const finishedRecording = session.recording;
  const finishedChunkNumber = session.currentChunkNumber;

  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }

  // Para a gravação atual
  await finishedRecording.stopAndUnloadAsync();
  const uri = finishedRecording.getURI();

  // Salva o arquivo no local definitivo
  const chunkId = `${session.meetingId}_chunk_${finishedChunkNumber}`;
  const destPath = `${Paths.document.uri}meeting_${session.meetingId}_chunk_${finishedChunkNumber}.m4a`;

  if (uri && uri !== destPath) {
    try {
      new File(uri).move(new File(destPath));
    } catch (e) {
      console.warn("Move failed, using original URI:", uri);
    }
  }

  // Inicia transcrição em background (não bloqueia)
  transcribeChunkInBackground(chunkId, destPath);

  // Inicia imediatamente o próximo chunk
  await startNewChunk();
}

async function transcribeChunkInBackground(
  chunkId: string,
  filePath: string
): Promise<void> {
  try {
    await updateChunkStatus(chunkId, "uploading");
    await notifyChunkChange();

    const text = await transcribeAudio(filePath);

    await updateChunkStatus(chunkId, "transcribed", text);
    await notifyChunkChange();
  } catch (error) {
    console.error(`Erro ao transcrever chunk ${chunkId}:`, error);
    // Mantém como "uploading" para retry posterior
  }
}

export async function stopSession(): Promise<string> {
  if (!session || !session.recording) {
    throw new Error("Nenhuma sessão de gravação ativa");
  }

  const meetingId = session.meetingId;
  const lastChunkNumber = session.currentChunkNumber;

  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }

  // Para a última gravação
  await session.recording.stopAndUnloadAsync();
  const uri = session.recording.getURI();

  const chunkId = `${meetingId}_chunk_${lastChunkNumber}`;
  const destPath = `${Paths.document.uri}meeting_${meetingId}_chunk_${lastChunkNumber}.m4a`;

  if (uri && uri !== destPath) {
    try {
      new File(uri).move(new File(destPath));
    } catch (e) {
      console.warn("Move failed, using original URI:", uri);
    }
  }

  // Transcreve o último chunk (aguarda)
  await updateChunkStatus(chunkId, "uploading");
  await notifyChunkChange();

  try {
    const text = await transcribeAudio(destPath);
    await updateChunkStatus(chunkId, "transcribed", text);
    await notifyChunkChange();
  } catch (error) {
    console.error("Erro ao transcrever último chunk:", error);
  }

  session = null;

  // Aguarda todas as transcrições pendentes
  await waitForAllTranscriptions(meetingId);

  // Concatena todos os textos
  const chunks = await getChunksForMeeting(meetingId);
  const fullText = chunks
    .filter((c) => c.transcription)
    .map((c) => c.transcription)
    .join("\n\n");

  return fullText;
}

async function waitForAllTranscriptions(meetingId: string): Promise<void> {
  // Poll a cada 2 segundos até todas estarem transcritas
  for (let i = 0; i < 60; i++) {
    const chunks = await getChunksForMeeting(meetingId);
    const allDone = chunks.every((c) => c.status === "transcribed");
    if (allDone) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function notifyChunkChange(): Promise<void> {
  if (!session?.onChunkStatusChange) return;
  const chunks = await getChunksForMeeting(session.meetingId);
  session.onChunkStatusChange(chunks);
}

export function getElapsedTime(): number {
  if (!session) return 0;
  return Date.now() - session.startTime;
}

export function isRecording(): boolean {
  return session !== null && !session.isPaused;
}

export function getCurrentChunkNumber(): number {
  return session?.currentChunkNumber ?? 0;
}
