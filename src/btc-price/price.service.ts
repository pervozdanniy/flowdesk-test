import { Inject, Injectable } from '@nestjs/common';
import { PRICE_PROVIDERS } from './const';

export interface PriceProvider {
  getMidPrice(timeout: number): Promise<number>;
}

@Injectable()
export class PriceService {
  constructor(
    @Inject(PRICE_PROVIDERS) private readonly providers: PriceProvider[],
  ) {}

  async getAvgPrice() {
    const prices = await Promise.allSettled(
      this.providers.map((p) => p.getMidPrice(1000)),
    );

    let sum = 0;
    let count = 0;
    for (const res of prices) {
      if (res.status === 'fulfilled') {
        count++;
        sum += res.value;
      }
    }

    return (sum / count).toFixed(4);
  }
}
