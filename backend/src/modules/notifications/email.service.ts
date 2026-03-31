import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { NotificationType } from './dto/create-notification.dto';

// ─── Brand constants ──────────────────────────────────────────────────────────
const BRAND_DARK  = '#1B4F72';
const BRAND_MID   = '#2E86C1';
const BRAND_LIGHT = '#AED6F1';

interface EmailSendResult {
  success:   boolean;
  messageId?: string;
  error?:    string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null = null;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.fromAddress = config.get<string>('FROM_EMAIL', 'noreply@sfit.gob.pe');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port:   config.get<number>('SMTP_PORT', 587),
        secure: config.get<number>('SMTP_PORT', 587) === 465,
        auth: {
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASS'),
        },
      });
    }
  }

  get isMockMode(): boolean {
    return this.transporter === null;
  }

  async send(
    email:   string,
    type:    NotificationType,
    title:   string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<EmailSendResult> {
    if (!email) {
      return { success: false, error: 'Sin email registrado' };
    }

    const html = this.buildHtml(type, title, content, metadata);

    if (this.isMockMode) {
      this.logger.log(`[Email MOCK] → ${email} | "${title}"`);
      this.logger.debug(`  HTML preview: ${title} — ${content}`);
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    try {
      const info = await this.transporter!.sendMail({
        from:    `"SFIT Notificaciones" <${this.fromAddress}>`,
        to:      email,
        subject: title,
        html,
      });
      this.logger.log(`Email enviado a ${email} — msgId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      this.logger.error(`Error al enviar email a ${email}`, err);
      return { success: false, error: (err as Error).message };
    }
  }

  // ── HTML template ─────────────────────────────────────────────────────────────
  private buildHtml(
    type:    NotificationType,
    title:   string,
    content: string,
    metadata?: Record<string, any>,
  ): string {
    const icon      = this.getIcon(type);
    const accentColor = this.getAccentColor(type);
    const metaRows  = metadata
      ? Object.entries(metadata)
          .map(([k, v]) => `<tr><td style="color:#666;padding:4px 8px;">${k}</td><td style="padding:4px 8px;">${v}</td></tr>`)
          .join('')
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">

        <!-- Header -->
        <tr>
          <td style="background:${BRAND_DARK};padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:2px;">SFIT</span>
                  <span style="color:${BRAND_LIGHT};font-size:13px;margin-left:8px;">Sistema de Fiscalización</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Accent bar -->
        <tr><td style="background:${accentColor};height:4px;"></td></tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="font-size:32px;margin:0 0 16px;">${icon}</p>
            <h1 style="color:${BRAND_DARK};font-size:20px;margin:0 0 16px;">${title}</h1>
            <p style="color:#444;font-size:15px;line-height:1.6;margin:0 0 24px;">${content}</p>

            ${metaRows ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e0e0e0;border-radius:4px;margin-bottom:24px;">
              <tbody>${metaRows}</tbody>
            </table>` : ''}

            <p style="color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:16px;margin:0;">
              Este es un mensaje automático del sistema SFIT. No responda este correo.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${BRAND_DARK};padding:16px 32px;text-align:center;">
            <span style="color:${BRAND_LIGHT};font-size:12px;">© ${new Date().getFullYear()} SFIT — Sistema de Fiscalización de Transporte</span>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private getIcon(type: NotificationType): string {
    const icons: Record<NotificationType, string> = {
      [NotificationType.FATIGA_RIESGO]:              '⚠️',
      [NotificationType.FATIGA_BLOQUEADO]:           '🚫',
      [NotificationType.SANCION]:                    '⚖️',
      [NotificationType.APELACION]:                  '📋',
      [NotificationType.REPORTE_NUEVO]:              '📝',
      [NotificationType.VIAJE_CERRADO_AUTO]:         '🔒',
      [NotificationType.PAUSA_RECOMENDADA]:          '☕',
      [NotificationType.ALERTA_CONDUCTOR_DIFERENTE]: '🚨',
    };
    return icons[type] ?? '🔔';
  }

  private getAccentColor(type: NotificationType): string {
    const urgent = [
      NotificationType.FATIGA_BLOQUEADO,
      NotificationType.SANCION,
      NotificationType.ALERTA_CONDUCTOR_DIFERENTE,
    ];
    if (urgent.includes(type)) return '#E74C3C';
    if (type === NotificationType.FATIGA_RIESGO) return '#E67E22';
    return BRAND_MID;
  }
}
