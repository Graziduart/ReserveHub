/** Serializa para JSON puro (Datas -> ISO) para o envelope de evento. */
export function toEventJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
