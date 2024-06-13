export enum PairSymbol {
  BTC_USDT = 'BTC_USDT',
}

export interface PriceProvider {
  getMidPrice(symbol: PairSymbol): Promise<number>;
}
