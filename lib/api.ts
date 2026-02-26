import type { MinutesData } from "./types";

// URL do backend — Vercel em produção
const API_BASE = __DEV__
  ? "http://192.168.1.100:3001" // IP local para dev (ajustar)
  : "https://onsite-minutes.vercel.app";

export async function transcribeAudio(filePath: string): Promise<string> {
  const formData = new FormData();

  // React Native FormData expects {uri, type, name} object for file uploads
  formData.append("audio", {
    uri: filePath,
    type: "audio/m4a",
    name: "audio.m4a",
  } as any);

  const response = await fetch(`${API_BASE}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Erro na transcrição: ${response.status} ${errorText}`);
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
    const errorText = await response.text().catch(() => "");
    throw new Error(`Erro ao enviar email: ${response.status} ${errorText}`);
  }
}
