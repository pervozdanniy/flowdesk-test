import { Controller, Get } from '@nestjs/common';
import { PriceService } from './price.service';

@Controller()
export class PriceController {
  constructor(private readonly appService: PriceService) {}

  @Get()
  async getHello(): Promise<number> {
    return this.appService.getAvgPrice();
  }
}
