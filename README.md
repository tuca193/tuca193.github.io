# Painel SSA 2 · Pernambuco

Painel de estudos para o **SSA 2** (Sistema Seriado de Avaliação de Pernambuco) —
ingresso 2027. Provas em **06/12/2026 e 13/12/2026, à tarde**.

## Estrutura

    index.html     → página inicial: informações do SSA, countdown das provas e cards de cada matéria
    <mat>.html     → uma página por matéria (port, edf, fis, geo, bio, qui, mat, ing, soc, his)
    style.css      → estilos
    script.js      → progresso (localStorage), barras e countdown
    build.js       → gera as páginas a partir do conteúdo do edital
    dev-server.js  → servidor local de desenvolvimento (node dev-server.js)

Na home, cada matéria tem um botão-card com sua barra de progresso. A barra global
(76 assuntos) é fixa no canto inferior direito, com contador e botão de reset.
Em cada página de matéria, os assuntos do edital têm:

- botão circular para marcar como concluído (salva automático);
- botão discreto **Detalhes** com conteúdo de estudo, dicas de como cai e links para vídeos/aulas.

## Publicação

Envie tudo para a branch `main` — o GitHub Pages serve o `index.html` automaticamente.
