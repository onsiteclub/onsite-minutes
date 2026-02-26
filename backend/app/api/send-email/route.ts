import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const maxDuration = 30;

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { to, recipientName, meetingTitle, html, pdfBase64 } =
      await request.json();

    if (!to || !html) {
      return NextResponse.json(
        { error: "Destinatário e conteúdo são obrigatórios" },
        { status: 400 }
      );
    }

    const attachments = pdfBase64
      ? [
          {
            filename: `ata-${meetingTitle?.replace(/\s+/g, "-").toLowerCase() || "reuniao"}.pdf`,
            content: pdfBase64,
          },
        ]
      : [];

    const fromAddress = process.env.EMAIL_FROM || "OnSite Minutes <onboarding@resend.dev>";

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject: `Ata de Reunião: ${meetingTitle || "Reunião"}`,
      html: `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1E293B; padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: #F97316; margin: 0; font-size: 20px;">OnSite Minutes</h1>
          </div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #E2E8F0;">
            ${html}
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
            <p style="color: #64748B; font-size: 12px;">
              Este email foi enviado automaticamente pelo OnSite Minutes.
            </p>
          </div>
        </div>
      `,
      attachments,
    });

    if (error) {
      console.error("Erro Resend:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return NextResponse.json(
      { error: "Erro ao enviar email" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}
