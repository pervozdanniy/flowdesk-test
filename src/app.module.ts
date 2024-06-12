import { Module } from '@nestjs/common';
import { BtcPriceModule } from './btc-price/btc-price.module';

@Module({
  imports: [BtcPriceModule],
})
export class AppModule {}
