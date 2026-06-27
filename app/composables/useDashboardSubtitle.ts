/**
 * useNavSubtitle - shared state for the topnav subtitle.
 * Each page calls setNavSubtitle('Operations Dashboard') in onMounted.
 */
export function useNavSubtitle(text?: string) {
  const subtitle = useState<string>('navSubtitle', () => 'Executive Command Center')
  if (text !== undefined) subtitle.value = text
  return { subtitle }
}
