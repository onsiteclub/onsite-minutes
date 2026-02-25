import * as SQLite from "expo-sqlite";
import type { Contact, Meeting, MeetingParticipant, AudioChunk } from "./types";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync("onsite-minutes.db");
    await migrate(db);
  }
  return db;
}

async function migrate(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'recording',
      minutes_json TEXT,
      pdf_path TEXT,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS meeting_participants (
      meeting_id TEXT REFERENCES meetings(id),
      contact_id TEXT REFERENCES contacts(id),
      sent_at INTEGER,
      PRIMARY KEY (meeting_id, contact_id)
    );

    CREATE TABLE IF NOT EXISTS audio_chunks (
      id TEXT PRIMARY KEY,
      meeting_id TEXT REFERENCES meetings(id),
      chunk_number INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      transcription TEXT,
      status TEXT DEFAULT 'recording',
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );
  `);
}

// --- Contacts ---

export async function getAllContacts(): Promise<Contact[]> {
  const database = await getDb();
  return database.getAllAsync<Contact>(
    "SELECT * FROM contacts ORDER BY name ASC"
  );
}

export async function createContact(
  name: string,
  email: string,
  phone: string
): Promise<Contact> {
  const database = await getDb();
  const id = Date.now().toString();
  await database.runAsync(
    "INSERT INTO contacts (id, name, email, phone) VALUES (?, ?, ?, ?)",
    [id, name, email, phone]
  );
  return { id, name, email, phone, created_at: Date.now() };
}

export async function updateContact(
  id: string,
  name: string,
  email: string,
  phone: string
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "UPDATE contacts SET name = ?, email = ?, phone = ? WHERE id = ?",
    [name, email, phone, id]
  );
}

export async function deleteContact(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM contacts WHERE id = ?", [id]);
}

// --- Meetings ---

export async function createMeeting(
  participantIds: string[]
): Promise<Meeting> {
  const database = await getDb();
  const id = Date.now().toString();
  const date = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  await database.runAsync(
    "INSERT INTO meetings (id, date, status) VALUES (?, ?, 'recording')",
    [id, date]
  );

  for (const contactId of participantIds) {
    await database.runAsync(
      "INSERT INTO meeting_participants (meeting_id, contact_id) VALUES (?, ?)",
      [id, contactId]
    );
  }

  return {
    id,
    title: null,
    date,
    status: "recording",
    minutes_json: null,
    pdf_path: null,
    created_at: Date.now(),
  };
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const database = await getDb();
  return database.getFirstAsync<Meeting>(
    "SELECT * FROM meetings WHERE id = ?",
    [id]
  );
}

export async function getAllMeetings(): Promise<Meeting[]> {
  const database = await getDb();
  return database.getAllAsync<Meeting>(
    "SELECT * FROM meetings ORDER BY created_at DESC"
  );
}

export async function updateMeetingStatus(
  id: string,
  status: Meeting["status"]
): Promise<void> {
  const database = await getDb();
  await database.runAsync("UPDATE meetings SET status = ? WHERE id = ?", [
    status,
    id,
  ]);
}

export async function updateMeetingMinutes(
  id: string,
  title: string,
  minutesJson: string,
  pdfPath: string
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "UPDATE meetings SET title = ?, minutes_json = ?, pdf_path = ?, status = 'done' WHERE id = ?",
    [title, minutesJson, pdfPath, id]
  );
}

export async function deleteMeeting(id: string): Promise<void> {
  const database = await getDb();
  await database.runAsync("DELETE FROM audio_chunks WHERE meeting_id = ?", [id]);
  await database.runAsync("DELETE FROM meeting_participants WHERE meeting_id = ?", [id]);
  await database.runAsync("DELETE FROM meetings WHERE id = ?", [id]);
}

// --- Meeting Participants ---

export async function getMeetingParticipants(
  meetingId: string
): Promise<(Contact & { sent_at: number | null })[]> {
  const database = await getDb();
  return database.getAllAsync<Contact & { sent_at: number | null }>(
    `SELECT c.*, mp.sent_at
     FROM contacts c
     JOIN meeting_participants mp ON c.id = mp.contact_id
     WHERE mp.meeting_id = ?
     ORDER BY c.name ASC`,
    [meetingId]
  );
}

export async function markParticipantSent(
  meetingId: string,
  contactId: string
): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    "UPDATE meeting_participants SET sent_at = strftime('%s','now') WHERE meeting_id = ? AND contact_id = ?",
    [meetingId, contactId]
  );
}

// --- Audio Chunks ---

export async function createAudioChunk(
  meetingId: string,
  chunkNumber: number,
  filePath: string
): Promise<AudioChunk> {
  const database = await getDb();
  const id = `${meetingId}_chunk_${chunkNumber}`;
  await database.runAsync(
    "INSERT INTO audio_chunks (id, meeting_id, chunk_number, file_path, status) VALUES (?, ?, ?, ?, 'recording')",
    [id, meetingId, chunkNumber, filePath]
  );
  return {
    id,
    meeting_id: meetingId,
    chunk_number: chunkNumber,
    file_path: filePath,
    transcription: null,
    status: "recording",
    created_at: Date.now(),
  };
}

export async function updateChunkStatus(
  id: string,
  status: AudioChunk["status"],
  transcription?: string
): Promise<void> {
  const database = await getDb();
  if (transcription !== undefined) {
    await database.runAsync(
      "UPDATE audio_chunks SET status = ?, transcription = ? WHERE id = ?",
      [status, transcription, id]
    );
  } else {
    await database.runAsync(
      "UPDATE audio_chunks SET status = ? WHERE id = ?",
      [status, id]
    );
  }
}

export async function getChunksForMeeting(
  meetingId: string
): Promise<AudioChunk[]> {
  const database = await getDb();
  return database.getAllAsync<AudioChunk>(
    "SELECT * FROM audio_chunks WHERE meeting_id = ? ORDER BY chunk_number ASC",
    [meetingId]
  );
}
