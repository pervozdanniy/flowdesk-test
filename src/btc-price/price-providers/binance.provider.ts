import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { WebsocketStream } from '@binance/connector-typescript';
import { PriceProvider } from '../price.service';
import { timedOut, withResolvers } from '../../util/promise';

type UpdatedPriceMessage = {
  u: number;
  s: string;
  b: string;
  B: string;
  a: string;
  A: string;
};

@Injectable()
export class BinanceProvider
  implements PriceProvider, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly resolvers = withResolvers<void>();
  private readonly logger = new Logger(BinanceProvider.name);
  private ws: WebsocketStream;
  private data: UpdatedPriceMessage | null = null;

  constructor(private readonly symbol: string) {}

  async getMidPrice(timeout = 1000) {
    await timedOut(this.resolvers.promise, timeout);

    return (parseFloat(this.data!.a) + parseFloat(this.data!.b)) / 2;
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
        error: () => {
          this.resolvers.reject();
          this.logger.error('Websocket error');
        },
      },
    });
    this.ws.bookTicker(this.symbol);
  }

  private onMessage(message: string) {
    const payload: UpdatedPriceMessage = JSON.parse(message);
    if (!this.data) {
      this.logger.debug('Fetched initial price data');
      this.resolvers.resolve();
    }
    this.data = payload;
  }
}
