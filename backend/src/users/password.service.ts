import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

@Injectable()
export class PasswordService {
  hash(plainPassword: string): string {
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${scryptSync(plainPassword, salt, KEY_LENGTH).toString('hex')}`;
  }

  verify(plainPassword: string, storedHash: string): boolean {
    const [salt, expectedHex] = storedHash.split(':');
    if (!salt || !expectedHex) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(plainPassword, salt, KEY_LENGTH);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
