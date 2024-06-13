import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import WebSocket from 'ws';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { PriceProvider, PairSymbol } from '../interface';

type PriceData = {
  seqId: number;
  ask: number;
  askSize: number;
  bid: number;
  bidSize: number;
  quoteTime: number;
  symbol: string;
};

type UpdatedPriceMessage = {
  ch: string;
  ts: number;
  tick: PriceData;
};

type PingMessage = { ping: number };

const isUpdatedPriceMessage = (
  payload: Record<any, any>,
): payload is UpdatedPriceMessage =>
  !!(payload as UpdatedPriceMessage).ch &&
  !!(payload as UpdatedPriceMessage).tick;

const isPingMessage = (payload: Record<any, any>): payload is PingMessage =>
  typeof (payload as PingMessage).ping === 'number';

const mapSymbol = (symbol: PairSymbol): PriceData['symbol'] => {
  switch (symbol) {
    case PairSymbol.BTC_USDT:
      return 'btcusdt';
    default:
      throw new Error('Unsupported symbol');
  }
};

@Injectable()
export class HuobiProvider
  implements PriceProvider, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(HuobiProvider.name);
  private ws: WebSocket;
  private reconnect = true;
  private cache = new Map<PriceData['symbol'], PriceData>();
  private readonly symbols: string[] = [];

  constructor(...symbols: PairSymbol[]) {
    this.symbols = symbols.map(mapSymbol);
  }

  async getMidPrice(symbol: PairSymbol): Promise<number> {
    const data = this.cache.get(mapSymbol(symbol));
    if (!data) {
      throw new Error(`No data for ${symbol} available`);
    }

    return (data.ask + data.bid) / 2;
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
      this.symbols.forEach((symbol, i) => {
        this.ws.send(
          JSON.stringify({
            sub: `market.${symbol}.bbo`,
            id: `id${i + 1}`,
          }),
        );
      });
    });

    this.ws
      .on('message', (message: Buffer) => this.onMessage(message))
      .on('error', (err) => this.logger.error(err.message, { err }))
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
    if (isUpdatedPriceMessage(payload)) {
      this.cache.set(payload.tick.symbol, payload.tick);
    }
  }
}
