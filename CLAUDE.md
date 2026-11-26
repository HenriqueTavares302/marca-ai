# Marca Aí — contexto do projeto

## O que é
App de agendamento para salão de cabeleireiro. Começou para o salão do pai do Henrique, que hoje usa o app Top Salão (R$ 19,90/mês). A ideia é fazer algo mais bonito e mais completo, gratuito no início e, no futuro, vendido para outros salões.

## Como trabalhamos
- O Henrique dá os prompts, o Claude escreve o código, o Henrique testa e aponta melhorias.
- Tudo é feito por partes, seguindo o backlog do GitHub: milestones "0 · Base" até "7 · Documentação", uma issue por passo. Trabalhar em uma issue de cada vez, na ordem.
- Cada issue tem "O que fazer" e "Como testar". Antes de fechar, conferir os dois.
- Mensagem de commit em português, curta, terminando com `Closes #N` da issue.
- Documentação completa só no final (milestone 7). Não criar documentos extras no meio do caminho.
- Antes de cada commit, fazer uma revisão rápida de segurança e me dizer o resultado: nenhuma chave ou senha no código, nenhum dado pessoal real (telefone, e-mail, endereço, nome de cliente), nada sensível em logs ou no console, links externos abrindo com rel=noopener, e dependências novas justificadas.

## Regras obrigatórias
- Nunca deixar assinatura do Claude: sem `Co-Authored-By`, sem link de sessão nos commits, sem "Generated with Claude Code" em PRs, issues ou código.
- Código sem comentários.
- Código simples e direto, que um iniciante consiga ler: JavaScript (não TypeScript), componentes funcionais, `useState`/`useEffect`, nada de bibliotecas ou padrões avançados sem necessidade.
- Nomes de arquivos, componentes, variáveis e textos da tela em português.
- Meus agendamentos sem login: a tela NUNCA busca agendamentos por um celular digitado (qualquer um veria os horários de outra pessoa). Até a issue #23 (login), ela mostra só os agendamentos criados neste aparelho: os ids ficam no `localStorage` ao confirmar, e `listarMeusAgendamentos` só devolve agendamentos do banco local do próprio aparelho.
- Nunca colocar chaves secretas no código. Só `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env` (que não vai para o Git).
- Dados de exemplo nunca usam telefones, e-mails ou documentos que possam ser reais: telefones sempre com DDD 00, e-mails @exemplo.com.

## Tecnologias
- React + Vite + Tailwind CSS (v4, via `@tailwindcss/vite`).
- Supabase: banco Postgres, login (Auth), fotos (Storage), tempo real (Realtime).
- Sem API própria: o React fala direto com o Supabase, com segurança por RLS. Edge Functions só onde é necessário: pagamento Pix (criar cobrança e receber webhook), lembretes automáticos e ações sensíveis do dono.
- Deploy na Vercel. Depois: PWA instalável e Capacitor para a Play Store.
- Plano grátis do Supabase pausa o projeto após 7 dias sem atividade e não tem backup automático; por isso existe a issue de rotina de backup.

## Banco de dados
Script em `supabase/01_tabelas.sql` (já testado). Tabelas: profissionais, servicos, servico_variacoes, profissional_servicos, horarios_trabalho, bloqueios, clientes, agendamentos, agendamento_servicos. A tabela agendamentos tem uma restrição (`sem_conflito_de_horario`) que impede dois agendamentos sobrepostos para o mesmo profissional. Até a milestone 4, as telas usam dados de exemplo em `src/data/` com os mesmos campos das tabelas. As telas nunca leem os arrays direto: usam só as funções de `src/data/consultas.js`, que são `async` (com `await` dentro de `useEffect`). Na milestone 4, só o conteúdo dessas funções muda para o Supabase. As datas dos agendamentos de exemplo são calculadas a partir do dia de hoje.

## Visual
- Paleta verde e dourado:
  - fundo `#FAF7F2`
  - texto `#1F1D1A`
  - principal (verde-escuro) `#1F4D3A` — texto branco por cima tem contraste 9,6:1
  - destaque (dourado) `#C9A15B` — só em detalhes (ícones, selos, estrelas); nunca como cor de texto sobre o fundo claro
- Ter modo escuro.
- Fontes: Inter no texto, Fraunces nos títulos (h1 a h3), via Google Fonts por enquanto; baixar para dentro do projeto na issue do PWA.
- Classes de cor do tema (em `src/index.css`, trocam sozinhas entre claro e escuro). As telas usam só estas: `bg-fundo`, `text-texto`, `text-texto-suave`, `bg-superficie`, `border-borda`, `bg-principal`, `text-sobre-principal`, `text-destaque`, `bg-perigo`, `text-perigo`, `text-sobre-perigo`, `bg-capa`, `text-sobre-capa` (capa da vitrine: verde-escuro nos dois modos; o dourado sobre ela é só enfeite, porque fica com 4:1). Bordas de destaque usam as mesmas cores: `border-principal`, `border-perigo` e `border-texto-suave` (essa última em campos de formulário, porque `border-borda` é clara demais para contornar um campo).
- Componentes base em `src/components/`: Botao, Card, CampoTexto, Seletor, Chip, Cabecalho, BarraInferior, Aviso, BotaoTema e Dialogo (confirmações, com foco preso, Esc e foco de volta ao botão; a opção segura vem primeiro). Usar esses antes de criar novos. O Botao vira link com `para` (rota interna) ou `linkExterno` (abre em outra janela).
- Funções de formatação (preço, duração, links do Maps e do WhatsApp) em `src/utils/formatos.js`; aberto/fechado e horário da semana em `src/utils/horarios.js`, calculados a partir dos horários de trabalho (não existe horário de funcionamento escrito à mão).
- Rótulos da barra inferior com 14 px e nomes curtos (ex.: Início, Agendar, Horários, Perfil), que caibam sem quebrar em celular de 360 px.
- Telas com a barra inferior precisam de espaço embaixo para o conteúdo não ficar escondido: `pb-[calc(7rem+env(safe-area-inset-bottom))]`.
- Aviso: sucesso some em 5 s; erro só fecha no X.
- Mobile-first, visual limpo e acolhedor, fotos grandes, pouco texto por tela.
- Acessibilidade: contraste de texto ≥ 4,5:1, botões com no mínimo 48 px de altura, texto do corpo ≥ 16 px, não depender só de cor para mostrar estado (livre, ocupado, confirmado).

## O que o app precisa resolver (vindo do uso real e do Top Salão)
- Cardápio de serviços com preço visível, inclusive tintura e escova, com variação por tamanho de cabelo (curto, médio, longo). O dono escolhe mostrar preço fixo, "a partir de" ou "sob consulta".
- Agendamento do cliente em poucos passos: serviços → profissional → data e horário → confirmação.
- Pagamento: pagar pessoalmente no salão é sempre permitido e é a opção padrão. Pix pelo app é só uma alternativa para quem quiser. O sinal antecipado só existe se o dono ligar essa opção nas configurações, e o cliente é avisado antes de escolher o horário.
- Problemas do Top Salão a evitar: cores sem padrão (lilás, azul, roxo, amarelo), pouco contraste, botões minúsculos ("X", "topo", "Hoje"), navegação por setas ▲▼, serviço escondido em lista suspensa, tela inicial "Entrar como cliente / profissional".
- Entrada: o cliente cai direto na vitrine (sem tela de escolha). Rodapé tem "Entrar como profissional". Quando houver login (issues #11 e #23), a capa ganha um botão "Entrar" para o cliente acessar os próprios horários.
- Diferenciais planejados: ficha do cliente com ficha técnica de coloração, galeria de trabalhos, lista de espera, lembrete de retorno, avaliação pós-atendimento, modo escuro.

## Rotas
- Definidas em `src/App.jsx` com React Router. Cliente: `/`, `/servicos`, `/agendar`, `/meus-agendamentos` (layout `src/layouts/LayoutCliente.jsx`).
- Caminho único do agendamento: a barra do cliente tem 3 itens, Início (`/`), Serviços (`/servicos`) e Horários (`/meus-agendamentos`). `/servicos` é o cardápio e também o primeiro passo do agendamento: o cliente escolhe os serviços ali e continua. `/agendar` é o restante do fluxo (profissional → data e horário → identificação → confirmação), sem item na barra e com botão voltar no cabeçalho. O botão "Agendar horário" da vitrine leva para `/servicos`.
- A escolha de serviços fica no `sessionStorage` pelas funções de `src/utils/agendamento.js`, guardando só os ids (serviço e tamanho); preço e duração são sempre recalculados dos dados. No total: se algum serviço escolhido é "a partir de", o total também é; "sob consulta" acrescenta "+ valor a combinar".
- Passos do agendamento, cada um com endereço próprio (para o voltar do celular ir passo a passo): `/agendar` (1 · Profissional), `/agendar/horario` (2 · Data e horário), `/agendar/dados` (3 · Seus dados), `/agendar/confirmacao` (4 · Confirmação). O profissional escolhido também fica no `sessionStorage` (vazio = "Qualquer profissional"); só aparecem profissionais que fazem todos os serviços escolhidos, e se o escolhido deixar de fazer algum, a escolha volta para "Qualquer profissional" com aviso.
- Horários livres: regra em funções puras em `src/utils/horariosLivres.js`, chamadas por `listarHorariosLivres(data, profissionalId, duracaoMinutos, servicoIds)` em `consultas.js` (vira a função do banco na issue #24). Começos de `intervalo_minutos` em `intervalo_minutos` a partir do início do expediente; o serviço inteiro cabe no expediente; não bate com bloqueios nem com agendamentos não cancelados; hoje respeita `antecedencia_minima_minutos` (os dois em `salao.js`). Com "Qualquer profissional", vale a união de quem faz todos os serviços, e o horário guarda o primeiro profissional livre. Data, horário e profissional atribuído ficam no `sessionStorage`; se deixarem de servir, são limpos com aviso.
- Dados do cliente (passo 3): nome, celular e observação ficam no `sessionStorage` para a confirmação. Nome e celular só vão para o `localStorage` se a caixa "Lembrar meus dados neste aparelho" estiver marcada; desmarcada ou "Limpar dados", nada fica no aparelho. Máscara e validação do celular em `src/utils/cliente.js`.
- Confirmação (passo 4) e sucesso (`/agendar/sucesso`): antes de salvar, o horário é conferido de novo; se foi ocupado, volta ao passo 2 com aviso, mantendo o resto. Enquanto não há banco, `criarAgendamento` em `consultas.js` grava no `localStorage` (`src/data/armazenamentoLocal.js`) com os mesmos campos das tabelas `clientes`, `agendamentos` e `agendamento_servicos`, recusa horário que se sobrepõe (como `sem_conflito_de_horario`), e todas as consultas juntam os dados de exemplo com os salvos. Depois do sucesso, a escolha do fluxo é limpa. `pix_ativo` em `salao.js` controla se a opção Pix aparece.
- Cancelar e remarcar (Meus agendamentos): só com `cancelamento_minimo_minutos` (em `salao.js`) ou mais de antecedência; fora do prazo, a tela esconde os botões e manda falar com o salão, e as funções `cancelarAgendamento` e `remarcarAgendamento` também recusam. Remarcar usa o "modo remarcação" (`sessionStorage`), mantém serviços e profissional, não conta o próprio agendamento como ocupado e atualiza o MESMO agendamento. Abrir Serviços ou Meus agendamentos encerra o modo remarcação.
- Datas e horas sempre no fuso America/Sao_Paulo, pelas funções de `src/utils/fuso.js` (nunca `getDay`, `getHours` ou `toLocale…` sem `timeZone`).
- Dentro do `/agendar` (todos os passos) a barra inferior fica escondida: no fluxo ficam só o voltar do cabeçalho e o botão fixo do rodapé (`RodapeFixo`), sempre visível sem rolar. O `RodapeFixo` mede a própria altura e reserva o mesmo espaço no fim da página, para nada ficar escondido atrás dele. Ao sair do fluxo, a barra volta. Salão: `/salao`, `/salao/servicos`, `/salao/clientes`, `/salao/configuracoes` (layout `src/layouts/LayoutSalao.jsx`). Os itens da barra e o título de cada tela ficam na lista do layout.
- `/componentes` é a página de teste dos componentes, fora dos layouts. Qualquer outro endereço cai na página "não encontrada".
- `vercel.json` manda todo endereço para o `index.html`, para recarregar numa rota interna sem dar 404.

## Comandos
- `npm install`
- `npm run dev` (abre também na rede local para testar no celular)
- `npm run build`
- `npm run lint`
