import { Inject, Injectable } from '@nestjs/common';
import { PRICE_PROVIDERS } from './di-tokens';
import { PriceProvider, PairSymbol } from './interface';

@Injectable()
export class PriceService {
  constructor(
    @Inject(PRICE_PROVIDERS) private readonly providers: PriceProvider[],
  ) {}

  async getAvgPrice() {
    const prices = await Promise.allSettled(
      this.providers.map((p) => p.getMidPrice(PairSymbol.BTC_USDT)),
    );

    let sum = 0;
    let count = 0;
    for (const res of prices) {
      if (res.status === 'fulfilled') {
        count++;
        sum += res.value;
      }
    }
    if (count === 0) {
      return 'N/A';
    }

    return (sum / count).toFixed(4);
  }
}
