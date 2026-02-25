export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: number;
}

export interface Meeting {
  id: string;
  title: string | null;
  date: string;
  status: "recording" | "processing" | "done";
  minutes_json: string | null;
  pdf_path: string | null;
  created_at: number;
}

export interface MeetingParticipant {
  meeting_id: string;
  contact_id: string;
  sent_at: number | null;
}

export interface AudioChunk {
  id: string;
  meeting_id: string;
  chunk_number: number;
  file_path: string;
  transcription: string | null;
  status: "recording" | "uploading" | "transcribed";
  created_at: number;
}

export interface MinutesData {
  title: string;
  date: string;
  attendees: string[];
  summary: string[];
  decisions: string[];
  action_items: { task: string; owner: string; due: string }[];
  risks: string[];
  next_steps: string[];
}

export type ProcessStep =
  | "uploading"
  | "transcribing"
  | "generating"
  | "building_pdf"
  | "done";
