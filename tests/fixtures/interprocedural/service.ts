export function getItemById(id: string) {
  return ItemModel.findOne({ where: { id } });
}
