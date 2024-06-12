import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PriceProvider } from '../price.service';
import WebSocket from 'ws';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { timedOut, withResolvers } from '../../util/promise';

type PriceData = {
  seqId: number;
  ask: number;
  askSize: number;
  bid: number;
  bidSize: number;
  quoteTime: number;
  symbol: string;
};

type PriceUpdatedMessage = {
  ch: string;
  ts: number;
  tick: PriceData;
};

type PingMessage = { ping: number };

const isPriceUpdatedMessage = (
  payload: Record<any, any>,
): payload is PriceUpdatedMessage =>
  !!(payload as PriceUpdatedMessage).ch &&
  !!(payload as PriceUpdatedMessage).tick;

const isPingMessage = (payload: Record<any, any>): payload is PingMessage =>
  typeof (payload as PingMessage).ping === 'number';

@Injectable()
export class HuobiProvider
  implements PriceProvider, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly resolvers = withResolvers<void>();
  private readonly logger = new Logger(HuobiProvider.name);
  private ws: WebSocket;
  private data: PriceData | null = null;
  private reconnect = true;

  constructor(private readonly symbol: string) {}

  async getMidPrice(timeout: number): Promise<number> {
    await timedOut(this.resolvers.promise, timeout);

    return (this.data!.ask + this.data!.bid) / 2;
  }

  onApplicationBootstrap() {
    this.connect();
  }

  onApplicationShutdown() {
    this.disconnect();
  }

  private connect() {
    this.ws = new WebSocket('wss://api.huobi.pro/ws');

    this.ws.on('open', () => {
      this.logger.debug('Connected to server');
      this.ws.send(
        JSON.stringify({ sub: `market.${this.symbol}.bbo`, id: 'id1' }),
      );
    });

    this.ws
      .on('message', (message: Buffer) => this.onMessage(message))
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

  private async onMessage(message: Buffer) {
    const payload = await promisify(gunzip)(message).then((buf) =>
      JSON.parse(buf.toString('utf8')),
    );
    if (isPingMessage(payload)) {
      this.ws.send(JSON.stringify({ pong: payload.ping }));
      return;
    }
    if (isPriceUpdatedMessage(payload)) {
      if (this.data === null) {
        this.logger.debug('Fetched initial price data');
        this.resolvers.resolve();
      }
      this.data = payload.tick;
    }
  }
}
