import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('editor startup', () => {
  it('renders the initial editor route without a runtime exception', () => {
    const html = renderToString(<MemoryRouter><App/></MemoryRouter>)
    expect(html).toContain('Загрузите данные')
  })
})
