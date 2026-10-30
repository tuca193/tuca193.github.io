# Redesign do Painel SSA 2 — Plano de implementação

> **Para agentes:** use superpowers:subagent-driven-development (recomendado) para executar tarefa a tarefa. Passos em checkbox (`- [ ]`).
> **Status:** aguardando aprovação do Arthur (arquitetura + direção de design). Nada aqui foi implementado.

**Objetivo:** transformar o painel estático de 11 páginas num app de estudos robusto, com perfis isolados, tema claro/escuro, estados de vazio/loading/erro e visual Liquid Glass sóbrio.

**Arquitetura (proposta, precisa de OK):** um único `index.html` (shell) + JavaScript em ES modules nativos, sem bundler, com rotas por hash (`#/`, `#/materias`, `#/materia/mat`, `#/provas`, `#/ajustes`). O conteúdo do edital sai do HTML gerado e vai para `data/edital.json`, gerado pelo `build.js` a partir de uma fonte que passa a ficar **dentro do repositório**. Continua publicável no GitHub Pages sem passo de build no servidor.

**Stack:** HTML + CSS (custom properties) + JS ES2020 modules. Dev only: `package.json` com ESLint, Stylelint e `node --test` (nenhuma dependência vai para o site).

## Restrições globais

- Comentários só quando necessários, em português e minúsculas: `funcao - faz isso`.
- Nenhum valor solto de cor/raio/blur/sombra/espaço fora de `css/tokens.css`.
- Uma biblioteca de ícones (Lucide, subset em sprite SVG local), traço 1.75 em todo o app.
- Contraste WCAG AA em claro e escuro, inclusive sobre vidro.
- Fallback sem `backdrop-filter`; respeitar `prefers-reduced-transparency` e `prefers-reduced-motion`.
- Transições 150–250 ms. Sem emojis, sem gradiente roxo/azul, sem textos de marketing.
- Commit e push só com aprovação explícita; sem Co-Authored-By.

## Foco de revisão (falhas prováveis que nenhum teste unitário pega)

1. Dados de um perfil aparecendo em outro após trocar perfil sem recarregar.
2. Duas abas abertas sobrescrevendo o progresso uma da outra.
3. Migração do `localStorage['ssa2']` antigo perdendo o progresso já marcado.
4. Countdown na virada do dia/hora e depois da 2ª prova.
5. Vidro ilegível (contraste) no tema claro sobre as manchas do fundo.

## Estrutura de arquivos

```
index.html                 shell único (header/sidebar/tabbar + <main> das views)
<mat>.html (x10)           redirecionam para index.html#/materia/<mat> (links antigos)
content/edital.md          fonte do conteúdo (copiada do arquivo temporário atual)
data/edital.json           gerado pelo build.js
build.js                   lê content/, valida e escreve data/ + páginas de redirecionamento
css/tokens.css             design tokens (claro/escuro)
css/base.css               reset, tipografia, layout
css/glass.css              superfícies de vidro + fallbacks
css/components.css         botões, campos, dialog, listas, skeleton
assets/icons.svg           sprite Lucide (subset)
assets/fonts/*.woff2       fontes auto-hospedadas
js/app.js                  bootstrap
js/router.js               rotas por hash
js/store/storage.js        wrapper seguro de localStorage + schema versionado + migração
js/store/profiles.js       CRUD de perfis + perfil ativo
js/store/progress.js       progresso por perfil
js/store/prefs.js          tema e preferências
js/data/edital.js          carrega data/edital.json (estado loading/erro)
js/lib/dates.js            countdown, ritmo, formatação pt-BR
js/ui/*.js                 componentes (dialog, toast, field, skeleton, profile-switcher, icon)
js/views/*.js              painel, materias, materia, provas, ajustes, perfis
test/*.test.js             node --test para store/ e lib/
```

## Tarefas

### T0 — Fundação e build reprodutível
- [ ] Copiar `C:/Users/arthu/AppData/Local/Temp/opencode/README.md` para `content/edital.md`; `build.js` lê caminho relativo.
- [ ] `build.js` gera `data/edital.json` + 10 páginas de redirecionamento; falha com mensagem clara se a fonte faltar.
- [ ] `package.json` com scripts `build`, `dev`, `lint` (eslint + stylelint), `test` (`node --test`).
- **Aceite:** `npm run build && npm run lint && npm test` sem erros nem warnings.

### T1 — Tokens, base e vidro (paralelo com T2)
- [ ] `tokens.css` da direção escolhida (cores, escala tipográfica, espaço 4/8/12/16/24/32/48, raios, blur, sombras, durações) em claro e escuro, com `[data-theme]` + `prefers-color-scheme`.
- [ ] `glass.css`: `.glass` com blur+saturate, borda 1px, brilho no topo, sombra em camadas; `@supports not (backdrop-filter…)` → superfície opaca; `prefers-reduced-transparency` → opaca.
- [ ] Fontes woff2 locais com `font-display: swap`; sprite de ícones.
- **Aceite:** página de amostra com todos os tokens; contraste AA medido nos dois temas.

### T2 — Camada de dados (paralelo com T1)
- [ ] `storage.js`: leitura/escrita com try/catch, chave `ssa2:v2`, `{version, profiles[], activeId, data:{[id]:{done:{key:isoDate}}}}`.
- [ ] Migração: se existir `ssa2` antigo, cria perfil "Meu perfil" com esse progresso e mantém o antigo intacto.
- [ ] `profiles.js`: criar/renomear/remover/selecionar; IDs via `crypto.randomUUID()`; nome aparado, 1–40 caracteres, único (sem diferenciar maiúsculas).
- [ ] `progress.js`: toggle por chave conhecida, contagens derivadas (nunca contador mantido à mão), evento `storage` para sincronizar abas.
- **Aceite:** testes de isolamento entre perfis, migração, nome inválido, chave desconhecida, JSON corrompido, sincronização entre abas.

### T3 — Shell e rotas
- [ ] Shell com sidebar de vidro (desktop), top bar + bottom bar de vidro (mobile < 760px), skip link, `<main tabindex=-1>` focado a cada troca de rota, título do documento por rota.
- [ ] Rota desconhecida → estado "página não encontrada" com link para o painel.
- **Aceite:** navegação completa por teclado; links antigos `mat.html` caem na matéria certa.

### T4 — Perfis
- [ ] Seletor no header/sidebar: avatar com iniciais, nome, menu com perfis, "Gerenciar perfis".
- [ ] `<dialog>` para criar/editar com validação junto ao campo e toast de sucesso; confirmação para excluir (diz o que será apagado).
- [ ] Sem perfis → tela de primeiro acesso com o formulário de criação.
- **Aceite:** marcar assuntos no perfil A, trocar para B, nada aparece; recarregar mantém o perfil ativo.

### T5 — Painel
- [ ] Progresso total, ritmo semanal necessário até a 1ª prova, countdown (sem `aria-live` por segundo; atualiza por minuto), próximo assunto com ação "Marcar como estudado", lista de matérias com próximo assunto.
- [ ] Skeleton enquanto carrega `edital.json`; erro dentro do bloco com "Tentar de novo".

### T6 — Matérias e matéria
- [ ] Lista de matérias; página da matéria com checklist (alvo ≥ 44px), detalhes em disclosure, filtro Todos/Pendentes/Estudados, busca; vazios honestos ("Nenhum assunto pendente em Física").

### T7 — Provas e Ajustes
- [ ] Provas: datas, horário (marcado como a confirmar), estado após as provas.
- [ ] Ajustes: tema (sistema/claro/escuro) persistido; exportar/importar backup JSON do perfil com validação; zerar progresso do perfil com confirmação.

### T8 — Passada de acessibilidade e responsividade
- [ ] 360/390/768/1024/1440; foco visível; labels e aria; contraste; reduced motion/transparency.

### T9 — Verificação
- [ ] `npm run build/lint/test` limpos; console sem erros.
- [ ] agent-browser: CRUD de perfis, isolamento, reload, mobile/desktop, claro/escuro, textos longos, muitos perfis, campos inválidos, datas no limite (mock de `Date`).
- [ ] Screenshots finais vs. Fase 1; `inspect.mjs --app` do taste-skill e correção do que soar genérico.

**Paralelismo:** T1 ∥ T2 → T3 → T4 ∥ T5 ∥ T6 ∥ T7 (arquivos de view separados) → T8 → T9.
