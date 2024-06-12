import { Inject, Injectable } from '@nestjs/common';
import { PRICE_PROVIDERS } from './const';

export interface PriceProvider {
  getAvgPrice(timeout: number): Promise<number>;
}

@Injectable()
export class PriceService implements PriceProvider {
  constructor(
    @Inject(PRICE_PROVIDERS) private readonly providers: PriceProvider[],
  ) {}

  async getAvgPrice(timeout = 1000) {
    const prices = await Promise.allSettled(
      this.providers.map((p) => p.getAvgPrice(timeout)),
    );

    let sum = 0;
    let count = 0;
    for (const res of prices) {
      if (res.status === 'fulfilled') {
        count++;
        sum += res.value;
      }
    }

    return sum / count;
  }
}
