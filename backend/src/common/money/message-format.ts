import { Kobo } from './kobo';

/** "₦1,200,000.00" for notification text. Integer arithmetic only, same as the frontend's formatKobo. */
export function formatKoboForMessage(amountKobo: Kobo): string {
  const absolute = Math.abs(amountKobo);
  const koboPart = absolute % 100;
  const wholeNaira = (absolute - koboPart) / 100;
  const grouped = String(wholeNaira).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amountKobo < 0 ? '-' : ''}₦${grouped}.${String(koboPart).padStart(2, '0')}`;
}
