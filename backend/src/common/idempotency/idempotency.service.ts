import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Clock } from '../clock/clock';
import { AppError, ConflictError } from '../errors/app-errors';
import { PrismaService } from '../../database/prisma.service';

export interface IdempotencyContext {
  readonly key: string;
  /** "METHOD /path" — a key may not be reused on a different operation. */
  readonly scope: string;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

type Replay<TResponse> = { readonly found: false } | { readonly found: true; readonly response: TResponse };

@Injectable()
export class IdempotencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /**
   * Runs `work` exactly once per key. The key is stored in the SAME transaction as the posting, so either both happen or
   * neither does. Same key + same payload → the original response. Same key + different payload → 409.
   *
   * Two requests with the same key at the same moment: the transaction write lock makes the second wait and then replay.
   * If they still collide (another process, or a database without a single writer), the loser's whole transaction rolls
   * back on the key's primary key — nothing is posted twice — and it answers with the winner's stored response.
   */
  async execute<TResponse>(context: IdempotencyContext, payload: unknown, work: () => Promise<TResponse>): Promise<TResponse> {
    const requestHash = createHash('sha256').update(stableStringify(payload)).digest('hex');
    try {
      return await this.prisma.transaction(async () => {
        const replay = await this.replay<TResponse>(context, requestHash);
        if (replay.found) return replay.response;
        const response = await work();
        await this.prisma.db.idempotencyKey.create({
          data: { key: context.key, scope: context.scope, requestHash, statusCode: 201, responseJson: JSON.stringify(response), createdAt: this.clock.nowIso() },
        });
        return response;
      });
    } catch (error) {
      if (error instanceof AppError && error.code === 'ALREADY_EXISTS') {
        const replay = await this.replay<TResponse>(context, requestHash);
        if (replay.found) return replay.response;
      }
      throw error;
    }
  }

  private async replay<TResponse>(context: IdempotencyContext, requestHash: string): Promise<Replay<TResponse>> {
    const existing = await this.prisma.db.idempotencyKey.findUnique({ where: { key: context.key } });
    if (!existing) return { found: false };
    if (existing.scope !== context.scope || existing.requestHash !== requestHash) {
      throw new ConflictError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used with a different request');
    }
    return { found: true, response: JSON.parse(existing.responseJson) as TResponse };
  }
}
