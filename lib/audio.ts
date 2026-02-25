import { Audio } from "expo-av";
import { File, Paths } from "expo-file-system";
import {
  createAudioChunk,
  updateChunkStatus,
  getChunksForMeeting,
} from "./database";
import { transcribeAudio } from "./api";
import { logger } from "./logger";
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
  logger.info("Requesting audio permissions...");
  const { granted } = await Audio.requestPermissionsAsync();
  logger.info(`Permissions granted: ${granted}`);
  if (granted) {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    logger.info("Audio mode set for recording");
  }
  return granted;
}

export async function startSession(
  meetingId: string,
  onChunkStatusChange?: (chunks: AudioChunk[]) => void
): Promise<void> {
  logger.info(`Starting session for meeting: ${meetingId}`);
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
  logger.info(`Starting chunk ${chunkNumber} for meeting ${session.meetingId}`);

  try {
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    logger.info(`Recording created successfully for chunk ${chunkNumber}`);

    session.recording = recording;

    const filePath = `${Paths.document.uri}meeting_${session.meetingId}_chunk_${chunkNumber}.m4a`;
    logger.info(`Chunk file path: ${filePath}`);

    await createAudioChunk(session.meetingId, chunkNumber, filePath);
    logger.info(`Chunk ${chunkNumber} saved to database`);
    await notifyChunkChange();
  } catch (error) {
    logger.error(`Failed to start chunk ${chunkNumber}:`, error);
    throw error;
  }

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
  logger.info(`Rotating chunk ${finishedChunkNumber}`);

  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }

  await finishedRecording.stopAndUnloadAsync();
  const uri = finishedRecording.getURI();
  logger.info(`Chunk ${finishedChunkNumber} stopped, URI: ${uri}`);

  const chunkId = `${session.meetingId}_chunk_${finishedChunkNumber}`;
  const destPath = `${Paths.document.uri}meeting_${session.meetingId}_chunk_${finishedChunkNumber}.m4a`;

  if (uri && uri !== destPath) {
    try {
      new File(uri).move(new File(destPath));
      logger.info(`Moved chunk to: ${destPath}`);
    } catch (e) {
      logger.warn(`Move failed, using original URI: ${uri}`);
    }
  }

  transcribeChunkInBackground(chunkId, destPath);
  await startNewChunk();
}

async function transcribeChunkInBackground(
  chunkId: string,
  filePath: string
): Promise<void> {
  try {
    logger.info(`Transcribing chunk ${chunkId}...`);
    await updateChunkStatus(chunkId, "uploading");
    await notifyChunkChange();

    const text = await transcribeAudio(filePath);
    logger.info(`Chunk ${chunkId} transcribed: ${text.substring(0, 100)}...`);

    await updateChunkStatus(chunkId, "transcribed", text);
    await notifyChunkChange();
  } catch (error) {
    logger.error(`Transcription failed for ${chunkId}:`, error);
  }
}

export async function stopSession(): Promise<string> {
  if (!session || !session.recording) {
    throw new Error("Nenhuma sessão de gravação ativa");
  }

  const meetingId = session.meetingId;
  const lastChunkNumber = session.currentChunkNumber;
  logger.info(`Stopping session for meeting ${meetingId}, last chunk: ${lastChunkNumber}`);

  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = null;
  }

  await session.recording.stopAndUnloadAsync();
  const uri = session.recording.getURI();
  logger.info(`Last recording stopped, URI: ${uri}`);

  const chunkId = `${meetingId}_chunk_${lastChunkNumber}`;
  const destPath = `${Paths.document.uri}meeting_${meetingId}_chunk_${lastChunkNumber}.m4a`;

  if (uri && uri !== destPath) {
    try {
      new File(uri).move(new File(destPath));
    } catch (e) {
      logger.warn(`Move failed, using original URI: ${uri}`);
    }
  }

  await updateChunkStatus(chunkId, "uploading");
  await notifyChunkChange();

  try {
    const text = await transcribeAudio(destPath);
    await updateChunkStatus(chunkId, "transcribed", text);
    await notifyChunkChange();
    logger.info("Last chunk transcribed");
  } catch (error) {
    logger.error("Failed to transcribe last chunk:", error);
  }

  session = null;

  await waitForAllTranscriptions(meetingId);

  const chunks = await getChunksForMeeting(meetingId);
  const fullText = chunks
    .filter((c) => c.transcription)
    .map((c) => c.transcription)
    .join("\n\n");

  logger.info(`Session complete. Total text length: ${fullText.length}`);
  return fullText;
}

async function waitForAllTranscriptions(meetingId: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const chunks = await getChunksForMeeting(meetingId);
    const allDone = chunks.every((c) => c.status === "transcribed");
    if (allDone) return;
    logger.info(`Waiting for transcriptions... (${i + 1}/60)`);
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
