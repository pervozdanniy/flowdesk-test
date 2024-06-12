import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PriceProvider } from '../price.service';
import WebSocket from 'ws';
import { timedOut, withResolvers } from '../util/promise';

type ErrorMessage = {
  error: string;
  method: 'subscribe' | string;
  success: false;
  time_in: Date['toISOString'];
  time_out: Date['toISOString'];
};

type PriceData = {
  symbol: string;
  bid: number;
  bid_qty: number;
  ask: number;
  ask_qty: number;
  last: number;
  volume: number;
  vwap: number;
  low: number;
  high: number;
  change: number;
  change_pct: number;
};

type DataMessage = {
  channel: 'ticker' | string;
  type: 'snapshot' | 'update' | string;
  data: Array<PriceData>;
};

const isError = (payload: Record<any, any>): payload is ErrorMessage =>
  typeof (payload as ErrorMessage).error === 'string';

const isData = (payload: Record<any, any>): payload is DataMessage =>
  (payload as DataMessage).channel === 'ticker';

@Injectable()
export class KrakenProvider
  implements PriceProvider, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly resolvers = withResolvers<void>();
  private readonly logger = new Logger(KrakenProvider.name);
  private ws?: WebSocket;
  private data: PriceData | null = null;
  private reconnect = true;

  constructor(private readonly symbol: string) {}

  async getAvgPrice(timeout = 1000): Promise<number> {
    await timedOut(this.resolvers.promise, timeout);

    return (this.data.bid + this.data.ask) / 2;
  }

  onApplicationBootstrap() {
    this.connect();
  }

  onApplicationShutdown() {
    this.disconnect();
  }

  private connect() {
    this.ws = new WebSocket('wss://ws.kraken.com/v2');

    this.ws.on('open', () => {
      this.logger.debug('Connected to server');
      this.ws.send(
        JSON.stringify({
          method: 'subscribe',
          params: {
            channel: 'ticker',
            symbol: [this.symbol],
          },
        }),
      );
    });

    this.ws
      .on('message', (message: string) => this.onMessage(message))
      .on('error', (err) => {
        this.logger.error(err.message, { err });
        this.resolvers.reject(err);
      })
      .on('close', () => {
        this.logger.debug('Disconnected from server');
        if (this.reconnect) {
          setTimeout(() => this.connect(), 2000);
        }
      });
  }

  private disconnect() {
    this.reconnect = false;
    this.ws.close();
  }

  private onMessage(message: string) {
    const payload = JSON.parse(message);
    if (isError(payload)) {
      this.resolvers.reject(payload.error);
      return;
    }
    if (isData(payload)) {
      if (!this.data) {
        this.logger.debug('Fetched initial price data');
        this.resolvers.resolve();
      }
      this.data = payload.data[0];
    }
  }
}
