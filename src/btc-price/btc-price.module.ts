import { Module } from '@nestjs/common';
import { PriceController } from './price.controller';
import { BinanceProvider } from './price-providers/binance.provider';
import { KrakenProvider } from './price-providers/kraken.provider';
import { PriceProvider, PriceService } from './price.service';
import { HuobiProvider } from './price-providers/huobi.provider';
import { PRICE_PROVIDERS } from './const';

@Module({
  imports: [],
  controllers: [PriceController],
  providers: [
    PriceService,
    { provide: BinanceProvider, useValue: new BinanceProvider('btcusdt') },
    { provide: KrakenProvider, useValue: new KrakenProvider('BTC/USDT') },
    { provide: HuobiProvider, useValue: new HuobiProvider('btcusdt') },
    {
      provide: PRICE_PROVIDERS,
      useFactory(...providers: PriceProvider[]) {
        return providers;
      },
      inject: [BinanceProvider, KrakenProvider, HuobiProvider],
    },
  ],
})
export class BtcPriceModule {}
