# Marca Aí

App de agendamento para salão de cabeleireiro: o cliente vê os serviços com preço e marca o horário pelo celular, e o salão organiza a agenda do dia.

## Tecnologias

- React + Vite
- Tailwind CSS
- Supabase (banco, login e arquivos)

## Como rodar

Precisa do Node.js 20 ou mais novo.

```bash
npm install
npm run dev
```

O terminal mostra dois endereços:

- `Local`: abra no navegador do computador.
- `Network`: abra no celular, conectado no mesmo Wi-Fi.

## Variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e preencha com os dados do projeto no Supabase (usados a partir da integração com o banco).

## Pastas

```
src/
  pages/        telas do app
  components/   peças reaproveitadas (botões, cards, campos)
  data/         dados de exemplo usados antes de ligar o banco
```
