import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcription, attendees, date } = await request.json();

    if (!transcription) {
      return NextResponse.json(
        { error: "Transcrição não fornecida" },
        { status: 400 }
      );
    }

    const systemPrompt = `Você é um assistente especializado em gerar atas de reunião profissionais para o setor de construção civil.

Sua tarefa:
1. Receber a transcrição bruta de uma reunião
2. ELIMINAR ruídos, conversas paralelas, hesitações, repetições e comentários irrelevantes
3. ORGANIZAR o conteúdo de forma clara e profissional
4. Gerar uma ata estruturada em JSON

Regras:
- Foque APENAS no conteúdo relevante da reunião
- Ignore conversas paralelas, piadas, comentários pessoais
- Corrija erros de transcrição quando o contexto permitir
- Atribua ações a pessoas específicas quando mencionadas
- Seja conciso mas completo
- Todos os textos em português brasileiro

Responda APENAS com o JSON, sem markdown ou texto adicional.`;

    const userPrompt = `Data: ${date}
Participantes: ${attendees.join(", ")}

Transcrição da reunião:
${transcription}

Gere a ata no seguinte formato JSON:
{
  "title": "Título descritivo da reunião",
  "date": "${date}",
  "attendees": ${JSON.stringify(attendees)},
  "summary": ["ponto 1", "ponto 2", ...],
  "decisions": ["decisão 1", "decisão 2", ...],
  "action_items": [{"task": "tarefa", "owner": "responsável", "due": "prazo"}],
  "risks": ["risco 1", ...],
  "next_steps": ["próximo passo 1", ...]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Resposta vazia da OpenAI");
    }

    // Limpa possíveis markdown wrappers
    const cleaned = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const minutes = JSON.parse(cleaned);

    return NextResponse.json(minutes);
  } catch (error) {
    console.error("Erro ao gerar ata:", error);
    return NextResponse.json(
      { error: "Erro ao gerar ata" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
