import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import WebSocket from 'ws';
import { AsyncCache, timedOut } from '../../util/promise';
import { PriceProvider, PairSymbol } from '../interface';

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

const mapSymbol = (symbol: PairSymbol): PriceData['symbol'] => {
  switch (symbol) {
    case PairSymbol.BTC_USDT:
      return 'BTC/USDT';
    default:
      throw new Error('Unsupported symbol');
  }
};

@Injectable()
export class KrakenProvider
  implements PriceProvider, OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(KrakenProvider.name);
  private ws: WebSocket;
  private reconnect = true;
  private cache = new AsyncCache<PriceData['symbol'], PriceData>();
  private readonly symbols: string[] = [];

  constructor(...symbols: PairSymbol[]) {
    for (const symbol of symbols) {
      const mapped = mapSymbol(symbol);
      this.symbols.push(mapped);
      this.cache.init(mapped);
    }
  }

  async getMidPrice(symbol: PairSymbol, timeout = 1000): Promise<number> {
    const data = await timedOut(this.cache.get(mapSymbol(symbol)), timeout);

    return (data.bid + data.ask) / 2;
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
            symbol: this.symbols,
          },
        }),
      );
    });

    this.ws
      .on('message', (message: string) => this.onMessage(message))
      .on('error', (err) => {
        this.logger.error(err.message, { err });
        this.cache.reject(err);
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
      this.cache.reject(payload.error);
      return;
    }
    if (isData(payload)) {
      for (const data of payload.data) {
        this.cache.set(data.symbol, data);
      }
    }
  }
}
