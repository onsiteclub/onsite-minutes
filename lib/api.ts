import { File } from "expo-file-system";
import type { MinutesData } from "./types";

// URL do backend — mudar para URL da Vercel em produção
const API_BASE = __DEV__
  ? "http://192.168.1.100:3001" // IP local para dev (ajustar)
  : "https://onsite-minutes-api.vercel.app";

export async function transcribeAudio(filePath: string): Promise<string> {
  const file = new File(filePath);
  const formData = new FormData();

  // File class implements Blob, so we can append directly
  formData.append("audio", file as unknown as Blob, "audio.m4a");

  const response = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Erro na transcrição: ${response.status}`);
  }

  const data = await response.json();
  return data.text;
}

export async function generateMinutes(
  transcription: string,
  attendees: string[],
  date: string
): Promise<MinutesData> {
  const response = await fetch(`${API_BASE}/api/minutes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcription, attendees, date }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao gerar ata: ${response.status}`);
  }

  return response.json();
}

export async function sendEmail(
  to: string,
  recipientName: string,
  meetingTitle: string,
  htmlContent: string,
  pdfBase64: string
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      recipientName,
      meetingTitle,
      html: htmlContent,
      pdfBase64,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar email: ${response.status}`);
  }
}
