# Marca Aí — contexto do projeto

## O que é
App de agendamento para salão de cabeleireiro. Começou para o salão do pai do Henrique, que hoje usa o app Top Salão (R$ 19,90/mês). A ideia é fazer algo mais bonito e mais completo, gratuito no início e, no futuro, vendido para outros salões.

## Como trabalhamos
- O Henrique dá os prompts, o Claude escreve o código, o Henrique testa e aponta melhorias.
- Tudo é feito por partes, seguindo o backlog do GitHub: milestones "0 · Base" até "7 · Documentação", uma issue por passo. Trabalhar em uma issue de cada vez, na ordem.
- Cada issue tem "O que fazer" e "Como testar". Antes de fechar, conferir os dois.
- Mensagem de commit em português, curta, terminando com `Closes #N` da issue.
- Documentação completa só no final (milestone 7). Não criar documentos extras no meio do caminho.

## Regras obrigatórias
- Nunca deixar assinatura do Claude: sem `Co-Authored-By`, sem link de sessão nos commits, sem "Generated with Claude Code" em PRs, issues ou código.
- Código sem comentários.
- Código simples e direto, que um iniciante consiga ler: JavaScript (não TypeScript), componentes funcionais, `useState`/`useEffect`, nada de bibliotecas ou padrões avançados sem necessidade.
- Nomes de arquivos, componentes, variáveis e textos da tela em português.
- Nunca colocar chaves secretas no código. Só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` (que não vai para o Git).

## Tecnologias
- React + Vite + Tailwind CSS (v4, via `@tailwindcss/vite`).
- Supabase: banco Postgres, login (Auth), fotos (Storage), tempo real (Realtime).
- Sem API própria: o React fala direto com o Supabase, com segurança por RLS. Edge Functions só onde é necessário: pagamento Pix (criar cobrança e receber webhook), lembretes automáticos e ações sensíveis do dono.
- Deploy na Vercel. Depois: PWA instalável e Capacitor para a Play Store.
- Plano grátis do Supabase pausa o projeto após 7 dias sem atividade e não tem backup automático; por isso existe a issue de rotina de backup.

## Banco de dados
Script em `supabase/01_tabelas.sql` (já testado). Tabelas: profissionais, servicos, servico_variacoes, profissional_servicos, horarios_trabalho, bloqueios, clientes, agendamentos, agendamento_servicos. A tabela agendamentos tem uma restrição (`sem_conflito_de_horario`) que impede dois agendamentos sobrepostos para o mesmo profissional. Até a milestone 4, as telas usam dados de exemplo em `src/data/` com os mesmos campos das tabelas.

## Visual
- Paleta verde e dourado:
  - fundo `#FAF7F2`
  - texto `#1F1D1A`
  - principal (verde-escuro) `#1F4D3A` — texto branco por cima tem contraste 9,6:1
  - destaque (dourado) `#C9A15B` — só em detalhes (ícones, selos, estrelas); nunca como cor de texto sobre o fundo claro
- Ter modo escuro.
- Fontes: Inter no texto, Fraunces nos títulos (h1 a h3), via Google Fonts por enquanto; baixar para dentro do projeto na issue do PWA.
- Classes de cor do tema (em `src/index.css`, trocam sozinhas entre claro e escuro). As telas usam só estas: `bg-fundo`, `text-texto`, `text-texto-suave`, `bg-superficie`, `border-borda`, `bg-principal`, `text-sobre-principal`, `text-destaque`, `bg-perigo`, `text-perigo`, `text-sobre-perigo`. Bordas de destaque usam as mesmas cores: `border-principal`, `border-perigo` e `border-texto-suave` (essa última em campos de formulário, porque `border-borda` é clara demais para contornar um campo).
- Componentes base em `src/components/`: Botao, Card, CampoTexto, Seletor, Chip, Cabecalho, BarraInferior, Aviso e BotaoTema. Usar esses antes de criar novos.
- Rótulos da barra inferior com 14 px e nomes curtos (ex.: Início, Agendar, Horários, Perfil), que caibam sem quebrar em celular de 360 px.
- Telas com a barra inferior precisam de espaço embaixo para o conteúdo não ficar escondido: `pb-[calc(7rem+env(safe-area-inset-bottom))]`.
- Aviso: sucesso some em 5 s; erro só fecha no X.
- Mobile-first, visual limpo e acolhedor, fotos grandes, pouco texto por tela.
- Acessibilidade: contraste de texto ≥ 4,5:1, botões com no mínimo 48 px de altura, texto do corpo ≥ 16 px, não depender só de cor para mostrar estado (livre, ocupado, confirmado).

## O que o app precisa resolver (vindo do uso real e do Top Salão)
- Cardápio de serviços com preço visível, inclusive tintura e escova, com variação por tamanho de cabelo (curto, médio, longo). O dono escolhe mostrar preço fixo, "a partir de" ou "sob consulta".
- Agendamento do cliente em poucos passos: serviços → profissional → data e horário → confirmação.
- Pagamento opcional: pagar no salão é o padrão; Pix pelo app é opcional (com sinal configurável).
- Problemas do Top Salão a evitar: cores sem padrão (lilás, azul, roxo, amarelo), pouco contraste, botões minúsculos ("X", "topo", "Hoje"), navegação por setas ▲▼, serviço escondido em lista suspensa, tela inicial "Entrar como cliente / profissional". Na nossa versão, o cliente cai direto na vitrine do salão e o profissional entra por um link "Sou do salão".
- Diferenciais planejados: ficha do cliente com ficha técnica de coloração, galeria de trabalhos, lista de espera, lembrete de retorno, avaliação pós-atendimento, modo escuro.

## Rotas
- Definidas em `src/App.jsx` com React Router. Cliente: `/`, `/servicos`, `/agendar`, `/meus-agendamentos` (layout `src/layouts/LayoutCliente.jsx`). Salão: `/salao`, `/salao/servicos`, `/salao/clientes`, `/salao/configuracoes` (layout `src/layouts/LayoutSalao.jsx`). Os itens da barra e o título de cada tela ficam na lista do layout.
- `/componentes` é a página de teste dos componentes, fora dos layouts. Qualquer outro endereço cai na página "não encontrada".
- `vercel.json` manda todo endereço para o `index.html`, para recarregar numa rota interna sem dar 404.

## Comandos
- `npm install`
- `npm run dev` (abre também na rede local para testar no celular)
- `npm run build`
- `npm run lint`
