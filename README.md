# Painel SSA 2

Painel de estudos para as provas do SSA 2 (6 e 13 de dezembro de 2026, à tarde).
Marque os assuntos como estudados — o progresso fica salvo no navegador (localStorage).

## Stack

    index.html           → painel principal (agora compacto)
    style.css            → estilos (CSS)
    script.js            → comportamento (JS)
    <materia><n>.html    → página independente de cada assunto (ex.: qui0.html, his9.html)

Cada assunto tem URL própria; o link "Ver detalhes" no painel leva a ela, e o
link "Voltar ao painel" retorna à âncora da matéria (ex.: `index.html#qui`).
Antes, todo o conteúdo vivia inline dentro do README.md.

## Como publicar

Envie os arquivos para a branch `main` deste repositório — o GitHub Pages
serve `index.html` automaticamente.
