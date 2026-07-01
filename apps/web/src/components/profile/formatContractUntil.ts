export function formatContractUntil(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("ru-RU");
}

export function formatContractLabel(isoDate: string): string {
  return `Контракт до ${formatContractUntil(isoDate)}`;
}
