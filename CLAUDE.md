# OnSite Minutes - Project Guide

## Overview

App React Native (Expo) que grava reuniões em blocos de 15 minutos, transcreve em paralelo com Whisper, e gera atas profissionais com GPT-4o. Envia por email aos participantes. Focado no setor de construção civil (OnSite Club), interface em português (pt-BR). Build iOS via Codemagic.

## Tech Stack

### Mobile (Expo)
- **Framework:** Expo SDK 54 + React Native 0.81 + TypeScript 5.9
- **Routing:** Expo Router 6 (file-based)
- **Áudio:** expo-av (gravação nativa, chunks de 15min)
- **Storage:** expo-sqlite (banco local), expo-file-system (arquivos de áudio)
- **Notificações:** expo-notifications (ata pronta)
- **PDF:** expo-print (geração via HTML template)

### Backend (Vercel - pasta `backend/`)
- **Framework:** Next.js 14.2 (API Routes only, porta 3001)
- **IA:** OpenAI — Whisper-1 (transcrição) + GPT-4o (geração de ata)
- **Email:** Resend (transacional, 100/dia grátis)
- **Config:** maxDuration=60 nas rotas

## Project Structure

```
onsite-minutes/
├── app/                          # Expo Router
│   ├── _layout.tsx               # Root layout (Stack)
│   ├── (tabs)/                   # Tab navigation
│   │   ├── _layout.tsx           # Tab config (Reuniões, Contatos, Histórico)
│   │   ├── index.tsx             # Home (nova reunião + recentes)
│   │   ├── contacts.tsx          # CRUD de contatos
│   │   └── history.tsx           # Histórico de reuniões
│   └── meeting/
│       ├── [id].tsx              # Tela de gravação + processamento
│       └── result/[id].tsx       # Resultado (ata + envio email)
├── components/
│   └── ParticipantSelector.tsx   # Modal seleção de participantes
├── lib/
│   ├── types.ts                  # Interfaces TypeScript
│   ├── database.ts               # SQLite setup + todas as queries
│   ├── audio.ts                  # Gravação + chunking + transcrição paralela
│   ├── api.ts                    # Chamadas HTTP ao backend
│   ├── pdf.ts                    # HTML → PDF (expo-print)
│   └── theme.ts                  # Design tokens (cores, spacing, fontSize)
├── backend/                      # API Vercel (projeto separado)
│   ├── app/api/
│   │   ├── transcribe/route.ts   # POST: áudio → Whisper → texto
│   │   ├── minutes/route.ts      # POST: texto → GPT-4o → ata JSON
│   │   └── send-email/route.ts   # POST: Resend → email com PDF
│   ├── package.json
│   ├── vercel.json               # CORS headers
│   └── .env.local                # API keys
├── app.json                      # Expo config (bundle ID, permissions)
└── package.json
```

## Pipeline de Gravação

```
Tempo:  0min          15min         30min         "Fim"
        |──────────────|──────────────|──────────────|
Grava:  [  chunk 1   ] [  chunk 2   ] [  chunk 3   ]
Trans:                  [ trans 1  ]   [ trans 2  ]  [ trans 3 ]

→ Concatena textos → GPT-4o → Ata JSON → PDF → Notificação → Envio email
```

## Database Schema (SQLite)

- **contacts:** id, name, email, phone, created_at
- **meetings:** id, title, date, status (recording|processing|done), minutes_json, pdf_path
- **meeting_participants:** meeting_id, contact_id, sent_at
- **audio_chunks:** id, meeting_id, chunk_number, file_path, transcription, status

## Commands

```bash
# Mobile
npm start                        # Expo dev server
npm run ios                      # iOS simulator

# Backend
cd backend && npm run dev        # API local (porta 3001)
cd backend && npx vercel --prod  # Deploy produção
```

## Environment Variables

### backend/.env.local
```
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
```

### lib/api.ts
- Dev: `http://192.168.x.x:3001` (ajustar IP local)
- Prod: URL da Vercel

## Code Conventions

- **Theme:** `lib/theme.ts` — Orange #F97316, Dark #1E293B, Gray #64748B
- **Styles:** StyleSheet.create (sem libs externas)
- **Handlers:** padrão `handleXxx`
- **Database:** queries centralizadas em `lib/database.ts`
- **Navegação:** Expo Router file-based
- **Idioma:** 100% português (pt-BR)
- **Sem auth:** app pessoal, sem login
