declare module 'hyphen/ru' {
  export function hyphenateSync(text: string, options?: { hyphenChar?: string; minWordLength?: number }): string
}
