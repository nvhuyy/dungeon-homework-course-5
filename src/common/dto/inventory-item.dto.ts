import { Item } from '../../entities/item.entity';

export class InventoryItemDto {
  item!: Item;
  quantity!: number;

  constructor(item: Item, quantity: number) {
    this.item = item;
    this.quantity = quantity;
  }
}