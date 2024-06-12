import { Controller, Get } from '@nestjs/common';
import { PriceService } from './price.service';

@Controller()
export class PriceController {
  constructor(private readonly appService: PriceService) {}

  @Get()
  async getPrice() {
    return this.appService.getAvgPrice();
  }
}
