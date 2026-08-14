export function resolveDistributionViolinSplitSelection(layoutMode: 'measures' | 'categories', visibleCategories: readonly string[], selectedFields: readonly string[], storedFirst?: string, storedSecond?: string) {
  const options = [...(layoutMode === 'measures' ? visibleCategories : selectedFields)]
  const first = options.includes(storedFirst ?? '') ? storedFirst! : options[0] ?? ''
  const second = options.includes(storedSecond ?? '') && storedSecond !== first ? storedSecond! : options.find((option) => option !== first) ?? ''
  return { options, first, second }
}
