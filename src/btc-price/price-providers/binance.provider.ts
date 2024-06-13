import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { WebsocketStream } from '@binance/connector-typescript';
import { PriceProvider, PairSymbol } from '../interface';

type UpdatedPriceMessage = {
  u: number;
  s: string;
  b: string;
  B: string;
  a: string;
  A: string;
};

const mapSymbol = (symbol: PairSymbol): UpdatedPriceMessage['s'] => {
  switch (symbol) {
    case PairSymbol.BTC_USDT:
      return 'BTCUSDT';
    default:
      throw new Error('Unsupported symbol');
  }
};

@Injectable()
export class BinanceProvider
  implements PriceProvider, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BinanceProvider.name);
  private ws: WebsocketStream;
  private cache = new Map<UpdatedPriceMessage['s'], UpdatedPriceMessage>();
  private readonly symbols: string[] = [];

  constructor(...symbols: PairSymbol[]) {
    this.symbols = symbols.map(mapSymbol);
  }

  async getMidPrice(symbol: PairSymbol) {
    const data = this.cache.get(mapSymbol(symbol));
    if (!data) {
      throw new Error(`No data for ${symbol} available`);
    }

    return (parseFloat(data.a) + parseFloat(data.b)) / 2;
  }

  onApplicationBootstrap() {
    this.connect();
  }

  onApplicationShutdown() {
    this.ws.disconnect();
  }

  private connect() {
    this.ws = new WebsocketStream({
      callbacks: {
        open: () => this.logger.debug('Connected to server'),
        close: () => this.logger.debug('Disconnected from server'),
        message: (data: string) => this.onMessage(data),
        error: () => this.logger.error('Websocket error'),
      },
    });
    for (const symbol of this.symbols) {
      this.ws.bookTicker(symbol);
    }
  }

  private onMessage(message: string) {
    const payload: UpdatedPriceMessage = JSON.parse(message);
    this.cache.set(payload.s, payload);
  }
}
