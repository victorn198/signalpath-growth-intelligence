import type { Lang } from './types'

export const ui = {
  en: { overview: 'Executive Growth', filters: 'Analysis scope', channel: 'Channel', device: 'Device', country: 'Country', all: 'All', reset: 'Restore default view', source: 'Public source', finding: 'What the data says', action: 'Recommended action', prior: 'vs. prior window', details: 'Detail', contact: 'Discuss a similar project', trust: 'Data Trust' },
  pt: { overview: 'Crescimento Executivo', filters: 'Escopo da análise', channel: 'Canal', device: 'Dispositivo', country: 'País', all: 'Todos', reset: 'Restaurar visão padrão', source: 'Fonte pública', finding: 'O que os dados mostram', action: 'Ação recomendada', prior: 'vs. janela anterior', details: 'Detalhe', contact: 'Conversar sobre um projeto similar', trust: 'Confiança dos dados' },
} satisfies Record<Lang, Record<string, string>>
