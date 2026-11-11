import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';
import { IsKobo } from '../../common/validation/is-kobo.decorator';
import { MAX_AMOUNT_KOBO } from '../../common/money/limits';

export class RepaymentDto {
  @IsKobo({ min: 1, max: MAX_AMOUNT_KOBO })
  amountKobo!: number;

  @IsCalendarDate()
  paymentDate!: string;
}
