import { useEffect } from 'react'

// sets the browser tab title. screen readers read it out when a page opens,
// so every page should have its own
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? title + ' · Lexicon' : 'Lexicon'
  }, [title])
}
