import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaderboardItem } from './common/dto/leaderboard-item.dto';
import { InventoryItemDto } from './common/dto/inventory-item.dto';
import { PageQueryDto } from './common/dto/page-query.dto';
import { InventoryItem } from './entities/inventory-item.entity';
import { Item } from './entities/item.entity';
import { Player } from './entities/player.entity';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Item)
    private readonly itemsRepo: Repository<Item>,
    @InjectRepository(Player)
    private readonly playersRepo: Repository<Player>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepo: Repository<InventoryItem>,
  ) {}

  private readonly monsters = [
    { name: 'Slime', icon: '🟢' },
    { name: 'Goblin', icon: '👺' },
    { name: 'Skeleton', icon: '💀' },
    { name: 'Orc', icon: '👹' },
    { name: 'Dragon', icon: '🐉' },
  ];

  private monsterMaxHp(kills: number) {
    return 8 + kills * 4;
  }

  private mapMonster(kills: number, hp: number | undefined | null) {
    const monsterId = kills % 5;
    const maxHp = this.monsterMaxHp(kills);
    return {
      name: this.monsters[monsterId].name,
      icon: this.monsters[monsterId].icon,
      hp: hp ?? maxHp,
      maxHp,
    };
  }

  private async convertToResponsePlayer(player: Player) {
    return {
      id: player.id,
      name: player.name,
      level: this.calculateLevel(player.xp),
      xp: player.xp,
      gold: player.gold,
      attack: await this.attackOf(player.id),
      kills: player.kills,
      monster: this.mapMonster(player.kills, player.monsterHp),
    };
  }

  private async findOnePlayerById(id: number) {
    const player = await this.playersRepo.findOneBy({ id });
    if (!player) {
      throw new NotFoundException();
    }

    return player;
  }

  private async findOneItemById(id: number) {
    const item = await this.itemsRepo.findOneBy({ id });
    if (!item) {
      throw new NotFoundException();
    }

    return item;
  }

  private calculateLevel(xp: number) {
    return 1 + Math.floor(xp / 100);
  }

  // STEP 1: items({ page, limit })
  async items(pageQueryDto: PageQueryDto) {
    const [data, total] = await this.itemsRepo.findAndCount({
      order: { id: 'ASC' },
      skip: (pageQueryDto.page - 1) * pageQueryDto.limit,
      take: pageQueryDto.limit,
    });

    return {
      data,
      page: pageQueryDto.page,
      limit: pageQueryDto.limit,
      total,
    };
  }

  // STEP 2: createPlayer(name), findPlayer(id), toPlayerView(player, attack = 1)
  async createPlayer(name: string) {
    const player = this.playersRepo.create({ name });
    const savedPlayer = await this.playersRepo.save(player);
    return this.convertToResponsePlayer(savedPlayer);
  }

  async findPlayer(id: number) {
    const player = await this.findOnePlayerById(id);
    return this.convertToResponsePlayer(player);
  }

  // STEP 3: attack(id)
  async attack(id: number) {
    const player = await this.findOnePlayerById(id);
    const damage = await this.attackOf(id);
    const currentHp = player.monsterHp ?? this.monsterMaxHp(player.kills);
    player.monsterHp = Math.max(currentHp - damage, 0);

    const isDefeated = player.monsterHp === 0;
    const rewardGold = 5 + player.kills * 2;

    if (isDefeated) {
      player.gold += rewardGold;
      player.xp += 25;
      player.kills++;
      player.monsterHp = null;
    }

    const updatedPlayer = await this.playersRepo.save(player);

    return {
      damage,
      defeated: isDefeated,
      reward: !isDefeated ? null : { gold: rewardGold, xp: 25 },
      player: await this.convertToResponsePlayer(updatedPlayer),
    };
  }

  // STEP 4: inventory(id), buy(playerId, itemId), attackOf(playerId)
  async inventory(id: number) {
    await this.findOnePlayerById(id);

    const inventoryItems = await this.inventoryItemsRepo.find({
      where: { playerId: id },
      relations: { item: true },
    });

    return inventoryItems.map(
      ({ item, quantity }) => new InventoryItemDto(item, quantity),
    );
  }

  async buy(playerId: number, itemId: number) {
    const player = await this.findOnePlayerById(playerId);
    const item = await this.findOneItemById(itemId);

    if (player.gold < item.price) {
      throw new BadRequestException();
    }

    const inventoryItem = await this.inventoryItemsRepo.findOneBy({
      playerId,
      itemId,
    });
    const quantity = (inventoryItem?.quantity ?? 0) + 1;
    const updatedInventoryItem = this.inventoryItemsRepo.create({
      id: inventoryItem?.id,
      playerId,
      itemId,
      quantity,
    });

    await this.inventoryItemsRepo.save(updatedInventoryItem);
    player.gold -= item.price;
    const updatedPlayer = await this.playersRepo.save(player);

    return { item, player: await this.convertToResponsePlayer(updatedPlayer) };
  }

  async attackOf(playerId: number): Promise<number> {
    const inventory = await this.inventory(playerId);
    return (
      1 +
      inventory.reduce(
        (total, entry) => total + entry.item.attack * entry.quantity,
        0,
      )
    );
  }

  // STEP 5: leaderboard({ page, limit }) without the N+1 problem
  async leaderboard(page: number, limit: number) {
    const offset = (page - 1) * limit;
    const [players, total] = await this.playersRepo.findAndCount({
      relations: { inventoryItems: { item: true } },
      order: { xp: 'DESC', id: 'ASC' },
      skip: offset,
      take: limit,
    });

    const data = players.map(
      (player, index) =>
        new LeaderboardItem(
          offset + index + 1,
          player.id,
          player.name,
          this.calculateLevel(player.xp),
          player.xp,
          player.gold,
          1 +
            player.inventoryItems.reduce(
              (totalAttack, entry) =>
                totalAttack + entry.item.attack * entry.quantity,
              0,
            ),
        ),
    );

    return {
      data,
      page,
      limit,
      total,
    };
  }
}
