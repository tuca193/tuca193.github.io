# Painel SSA 2 · Pernambuco

Painel de estudos para o **SSA 2** (Sistema Seriado de Avaliação da UPE), ingresso 2027.
Provas previstas para **06/12/2026 e 13/12/2026, à tarde** (confira sempre o edital oficial).

## O que tem

- os 76 assuntos do edital em 10 matérias, com detalhes do que estudar e links de estudo;
- perfis: cada pessoa tem o próprio progresso no mesmo navegador, sem misturar;
- painel com ritmo semanal até a prova, contagem regressiva e próximo assunto;
- busca, filtros, tema claro/escuro e backup em JSON.

Tudo fica salvo no `localStorage` do navegador. Nada é enviado para servidor.

## Estrutura

    index.html          shell único (rotas por hash: #/, #/materias, #/materia/<id>, #/provas, #/ajustes, #/perfis)
    <materia>.html      redirecionam os links antigos para index.html#/materia/<id>
    data/edital.json    conteúdo do edital (fonte de verdade)
    css/                tokens, base, vidro, componentes e uma folha por tela
    js/store/           perfis, progresso e persistência (testados)
    js/lib/, js/ui/     helpers de dom e datas, componentes
    js/views/           uma tela por arquivo
    assets/             fontes (Hanken Grotesk, OFL) e ícones (Lucide, ISC)
    test/               testes com node --test

## Desenvolvimento

    npm install
    npm run dev       # http://localhost:8000 (PORT=8123 npm run dev para outra porta)
    npm run check     # build (valida o edital) + lint + testes

## Publicação

O GitHub Pages serve o `index.html` direto da branch `main`; não há passo de build no servidor.
