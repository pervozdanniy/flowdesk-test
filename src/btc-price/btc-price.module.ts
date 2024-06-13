import { Module } from '@nestjs/common';
import { PriceController } from './price.controller';
import { BinanceProvider } from './price-providers/binance.provider';
import { KrakenProvider } from './price-providers/kraken.provider';
import { PriceService } from './price.service';
import { HuobiProvider } from './price-providers/huobi.provider';
import { PRICE_PROVIDERS } from './di-tokens';
import { PriceProvider, PairSymbol } from './interface';

@Module({
  imports: [],
  controllers: [PriceController],
  providers: [
    PriceService,
    {
      provide: BinanceProvider,
      useValue: new BinanceProvider(PairSymbol.BTC_USDT),
    },
    {
      provide: KrakenProvider,
      useValue: new KrakenProvider(PairSymbol.BTC_USDT),
    },
    {
      provide: HuobiProvider,
      useValue: new HuobiProvider(PairSymbol.BTC_USDT),
    },
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
