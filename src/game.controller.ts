import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { GameService } from './game.service';
import { DataSource } from 'typeorm';
import { BuyItemDto } from './common/dto/buy-item.dto';
import { CreatePlayerDto } from './common/dto/create-player.dto';
import { PageQueryDto } from './common/dto/page-query.dto';

@Controller()
export class GameController {
  constructor(
    private readonly game: GameService,
    private readonly dataSource: DataSource,
  ) {}

  // STEP 0: @Get('health')
  @Get('health')
  async health() {
    await this.dataSource.query('SELECT 1');
    return { db: 'up' };
  }

  // STEP 1: @Get('items')
  @Get('items')
  findAll(@Query() query: PageQueryDto) {
    return this.game.items(query);
  }

  // STEP 2: @Post('players'), @Get('players/:id')
  @Post('players')
  @HttpCode(HttpStatus.CREATED)
  createPlayer(@Body() createPlayerDto: CreatePlayerDto) {
    return this.game.createPlayer(createPlayerDto.name);
  }

  @Get('players/:id')
  findPlayer(@Param('id', ParseIntPipe) id: number) {
    return this.game.findPlayer(id);
  }

  // STEP 3: @Post('players/:id/attack')
  @Post('players/:id/attack')
  @HttpCode(HttpStatus.CREATED)
  attack(@Param('id', ParseIntPipe) id: number) {
    return this.game.attack(id);
  }

  // STEP 4: @Get('players/:id/inventory'), @Post('players/:id/buy')
  @Get('players/:id/inventory')
  findInventoryItems(@Param('id', ParseIntPipe) id: number) {
    return this.game.inventory(id);
  }

  @Post('players/:id/buy')
  buy(@Param('id', ParseIntPipe) id: number, @Body() body: BuyItemDto) {
    return this.game.buy(id, body.itemId);
  }

  // STEP 5: @Get('leaderboard')
  @Get('leaderboard')
  leaderboard(@Query() query: PageQueryDto) {
    return this.game.leaderboard(query.page, query.limit);
  }
}
