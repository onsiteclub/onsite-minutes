import * as Print from "expo-print";
import { File, Paths } from "expo-file-system";
import type { MinutesData } from "./types";

export async function generatePdf(
  minutes: MinutesData,
  meetingId: string
): Promise<string> {
  const html = buildHtml(minutes);

  const { uri } = await Print.printToFileAsync({ html });

  // Move para local definitivo
  const destFile = new File(Paths.document, `ata_${meetingId}.pdf`);
  new File(uri).move(destFile);

  return destFile.uri;
}

export async function getPdfBase64(pdfPath: string): Promise<string> {
  const file = new File(pdfPath);
  const bytes = await file.bytes();
  // Convert Uint8Array to base64
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildHtml(m: MinutesData): string {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        color: #1E293B;
        padding: 40px;
        line-height: 1.6;
      }
      .header {
        border-bottom: 3px solid #F97316;
        padding-bottom: 16px;
        margin-bottom: 24px;
      }
      .header h1 {
        color: #F97316;
        margin: 0;
        font-size: 24px;
      }
      .header .date {
        color: #64748B;
        font-size: 14px;
        margin-top: 4px;
      }
      .header .brand {
        color: #64748B;
        font-size: 12px;
        margin-top: 8px;
      }
      h2 {
        color: #1E293B;
        font-size: 16px;
        border-left: 4px solid #F97316;
        padding-left: 12px;
        margin-top: 24px;
      }
      ul { padding-left: 20px; }
      li { margin-bottom: 6px; font-size: 14px; }
      .action-item {
        background: #FFF7ED;
        border-left: 3px solid #F97316;
        padding: 8px 12px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 14px;
      }
      .action-owner { color: #F97316; font-weight: 600; }
      .action-due { color: #64748B; font-size: 12px; }
      .attendees {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 16px;
      }
      .attendee {
        background: #F1F5F9;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${m.title}</h1>
      <div class="date">${m.date}</div>
      <div class="brand">OnSite Minutes</div>
    </div>

    <h2>Participantes</h2>
    <div class="attendees">
      ${m.attendees.map((a) => `<span class="attendee">${a}</span>`).join("")}
    </div>

    ${
      m.summary.length > 0
        ? `<h2>Resumo</h2><ul>${m.summary.map((s) => `<li>${s}</li>`).join("")}</ul>`
        : ""
    }

    ${
      m.decisions.length > 0
        ? `<h2>Decisões</h2><ul>${m.decisions.map((d) => `<li>${d}</li>`).join("")}</ul>`
        : ""
    }

    ${
      m.action_items.length > 0
        ? `<h2>Ações</h2>${m.action_items
            .map(
              (a) =>
                `<div class="action-item">
                  <div>${a.task}</div>
                  <span class="action-owner">${a.owner}</span>
                  ${a.due ? `<span class="action-due"> — ${a.due}</span>` : ""}
                </div>`
            )
            .join("")}`
        : ""
    }

    ${
      m.risks.length > 0
        ? `<h2>Riscos</h2><ul>${m.risks.map((r) => `<li>${r}</li>`).join("")}</ul>`
        : ""
    }

    ${
      m.next_steps.length > 0
        ? `<h2>Próximos Passos</h2><ul>${m.next_steps.map((n) => `<li>${n}</li>`).join("")}</ul>`
        : ""
    }
  </body>
  </html>`;
}
