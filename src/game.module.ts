import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './entities/item.entity';
import { Player } from './entities/player.entity';
import { InventoryItem } from './entities/inventory-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, Player, InventoryItem]),
  ],
  controllers: [GameController],
  providers: [GameService],
})
export class GameModule {}
