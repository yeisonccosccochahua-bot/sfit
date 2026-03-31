import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType } from './dto/create-notification.dto';

interface WaSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Simple in-memory rate limiter: max 100 messages / minute
interface RateBucket {
  count:   number;
  resetAt: number;
}

@Injectable()
export class WhatsappService {
  private readonly logger  = new Logger(WhatsappService.name);
  private readonly token:   string | undefined;
  private readonly phoneId: string | undefined;
  private readonly apiBase = 'https://graph.facebook.com/v19.0';
  private readonly bucket: RateBucket = { count: 0, resetAt: 0 };

  constructor(private readonly config: ConfigService) {
    this.token   = config.get<string>('WHATSAPP_TOKEN');
    this.phoneId = config.get<string>('WHATSAPP_PHONE_ID');
  }

  get isMockMode(): boolean {
    return !this.token || !this.phoneId;
  }

  async send(
    phone:   string,
    type:    NotificationType,
    title:   string,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<WaSendResult> {
    if (!phone) {
      return { success: false, error: 'Sin número de teléfono registrado' };
    }

    // Enforce rate limit
    if (!this.checkRateLimit()) {
      this.logger.warn(`WhatsApp rate limit alcanzado (100/min) — mensaje descartado para ${phone}`);
      return { success: false, error: 'RATE_LIMIT_EXCEEDED' };
    }

    if (this.isMockMode) {
      return this.sendMock(phone, type, title, content, metadata);
    }

    return this.sendReal(phone, type, title, content);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private sendMock(
    phone:    string,
    type:     NotificationType,
    title:    string,
    content:  string,
    metadata?: Record<string, any>,
  ): WaSendResult {
    this.logger.log(
      `[WhatsApp MOCK] → ${phone} | tipo: ${type} | "${title}"\n` +
      `  ${content}` +
      (metadata ? `\n  metadata: ${JSON.stringify(metadata)}` : ''),
    );
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  private async sendReal(
    phone:   string,
    type:    NotificationType,
    title:   string,
    content: string,
  ): Promise<WaSendResult> {
    const normalizedPhone = phone.replace(/\D/g, '');
    const body = {
      messaging_product: 'whatsapp',
      to:   normalizedPhone,
      type: 'text',
      text: { preview_url: false, body: `*${title}*\n\n${content}` },
    };

    try {
      const res = await fetch(`${this.apiBase}/${this.phoneId}/messages`, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.error(`WhatsApp API error ${res.status}: ${err}`);
        return { success: false, error: `HTTP ${res.status}` };
      }

      const data = (await res.json()) as { messages?: Array<{ id: string }> };
      const messageId = data.messages?.[0]?.id;
      this.logger.log(`WhatsApp enviado a ${normalizedPhone} — msgId: ${messageId}`);
      return { success: true, messageId };
    } catch (err) {
      this.logger.error('Error en llamada a WhatsApp API', err);
      return { success: false, error: (err as Error).message };
    }
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now > this.bucket.resetAt) {
      this.bucket.count   = 0;
      this.bucket.resetAt = now + 60_000;
    }
    if (this.bucket.count >= 100) return false;
    this.bucket.count++;
    return true;
  }
}
