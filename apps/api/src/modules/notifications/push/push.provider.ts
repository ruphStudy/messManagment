import { Logger } from '@nestjs/common';

export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  /** Routing only (e.g. screen, notificationId). Never secrets. */
  data: Record<string, unknown>;
}

export type PushResult = { ok: true } | { ok: false; /** The device should be deactivated. */ deviceGone: boolean; error: string };

/** Delivery adapter so notification logic is not tied to Expo. */
export interface PushProvider {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

/** Development: no network, just logs what would be sent. */
export class LogPushProvider implements PushProvider {
  private readonly logger = new Logger('Push');
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    for (const m of messages) this.logger.log(`→ ${m.to.slice(0, 22)}… "${m.title}"`);
    return messages.map(() => ({ ok: true }));
  }
}

export class DisabledPushProvider implements PushProvider {
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    return messages.map(() => ({ ok: false, deviceGone: false, error: 'Push disabled' }));
  }
}

/** Expo push service (https://docs.expo.dev/push-notifications/sending-notifications/). Sends in chunks of 100. */
export class ExpoPushProvider implements PushProvider {
  private readonly logger = new Logger('ExpoPush');

  constructor(
    private readonly url: string,
    private readonly accessToken: string | null,
  ) {}

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    const results: PushResult[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const res = await fetch(this.url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
          },
          body: JSON.stringify(chunk.map((m) => ({ ...m, sound: 'default' }))),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data?: { status: string; message?: string; details?: { error?: string } }[] };
        for (const [j] of chunk.entries()) {
          const ticket = json.data?.[j];
          results.push(
            ticket?.status === 'ok'
              ? { ok: true }
              : { ok: false, deviceGone: ticket?.details?.error === 'DeviceNotRegistered', error: ticket?.message ?? 'Unknown push error' },
          );
        }
      } catch (error) {
        this.logger.warn(`Push request failed: ${(error as Error).message}`);
        results.push(...chunk.map(() => ({ ok: false as const, deviceGone: false, error: (error as Error).message })));
      }
    }
    return results;
  }
}
