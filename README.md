# MADM — Coleta de Documentos e Mídias

Sistema de coleta de documentos, comprovantes, áudio e vídeo via link único, acionado por automação (Make/Integromat) a partir do CRM.

## Fluxo

```
Kommo (lead entra na etapa "Coleta de Documentação")
        │  gatilho: mudança de status do lead
        ▼
Cenário A no Make: HTTP POST → /webhook/collections
   body: { name, phone, externalId: <id do lead>, callbackUrl: <URL do gatilho do Cenário B> }
        │
        ▼
API cria (ou reaproveita) o cliente e a coleta, devolve { link, token, collectionId }
        │
        ▼
Make grava o link num campo do lead na Kommo e/ou envia a mensagem ao cliente
   ex: "Olá {{name}}, envie seus documentos aqui: {{link}}"
        │
        ▼
Cliente abre o link e envia os documentos, um por um
        │
        ▼
A cada documento enviado, a API dispara um POST para o callbackUrl (Cenário B, gatilho "Custom Webhook")
        │
        ▼
Cenário B no Make: recebe o evento e atualiza a Kommo (nota na timeline do lead, campo de progresso, etc.)
```

Não existe painel interno de colaborador nesta versão — apenas os dois pontos de integração com o Make (webhook de entrada e callback de saída) e o portal do cliente.

### 1. Cenário A no Make — criar a coleta

- Gatilho: **"Status do lead mudou"** (Kommo), filtrando pela etapa "Coleta de Documentação".
- Módulo **HTTP → Make a request**: `POST` para `SEU_DOMINIO/webhook/collections`, com o header `X-Webhook-Secret` e o corpo descrito abaixo (incluindo o `callbackUrl`, que é a URL do gatilho do Cenário B — veja o passo 3).
- Módulo seguinte: atualizar o campo customizado do lead na Kommo com `{{link}}` da resposta, e/ou disparar a mensagem ao cliente citando `{{name}}`.

### 2. Cenário B no Make — receber os eventos em tempo real

- Gatilho: **"Custom Webhook"** (módulo nativo do Make). Ao criar esse gatilho, o Make gera uma URL única — é essa URL que você cola no campo `callbackUrl` do Cenário A.
- Corpo recebido a cada chamada (veja formato completo mais abaixo): inclui `event` (`media:uploaded` ou `collection:completed`), `externalId` (o id do lead que você mandou no Cenário A), nome do cliente e qual documento foi enviado.
- Módulos seguintes: usar um **Router**/filtro por `event` e `item.type` para, por exemplo, adicionar uma nota na timeline do lead a cada documento, ou mudar a etapa do funil quando `event = collection:completed`.

Crie o Cenário B primeiro (para ter a URL do webhook pronta) e só depois monte o Cenário A referenciando essa URL.

## Stack

- **Backend**: Node.js + TypeScript + Express + Prisma
- **Banco**: PostgreSQL — local via Docker Compose, produção via banco gerenciado (Render, Neon, Supabase...)
- **Storage (atual)**: disco local (`apps/api/uploads`, ou um disco persistente em produção) atrás da interface `StorageService` — trocar para S3/Cloudinary implementando a mesma interface
- **Frontend**: React + Vite + TypeScript + Tailwind CSS (somente o portal do cliente)

## Como rodar localmente

### 1. Instalar dependências (raiz do monorepo)

```bash
npm install
```

### 2. Banco de dados (Postgres via Docker)

```bash
docker compose up -d   # sobe o Postgres na porta 5432 (requer Docker Desktop)
```

```bash
cd apps/api
cp .env.example .env
npm run db:migrate    # aplica as migrations no Postgres local
npm run db:seed       # cria um cliente e uma coleta de exemplo
```

O seed imprime no terminal um **link de coleta de teste** e um exemplo de chamada de webhook.

### 3. Subir a API

```bash
npm run dev   # dentro de apps/api — http://localhost:4000
```

### 4. Subir o frontend

```bash
cd apps/web
cp .env.example .env   # opcional em dev — deixe VITE_API_URL comentado
npm run dev   # http://localhost:5173
```

## Publicar em produção (Render)

O repositório já tem um `render.yaml` (raiz) que provisiona tudo de uma vez: banco Postgres, disco persistente para os uploads, a API e o site do portal do cliente.

1. No painel do Render: **New → Blueprint**, aponte para este repositório (ele detecta o `render.yaml` sozinho).
2. Confirme a criação — o Render vai criar 3 recursos: `forms-madm-db` (Postgres), `forms-madm-api` (backend) e `forms-madm-web` (frontend).
3. Espere o primeiro deploy terminar e anote as duas URLs que o Render gerou (algo como `https://forms-madm-api.onrender.com` e `https://forms-madm-web.onrender.com`).
4. Volte nas variáveis de ambiente:
   - Em **forms-madm-api**: preencha `APP_URL` com a URL da própria API, e `CLIENT_URL` com a URL do **forms-madm-web**.
   - Em **forms-madm-web**: preencha `VITE_API_URL` com a URL da **forms-madm-api**.
5. Clique em "Manual Deploy" nos dois serviços para aplicar as variáveis novas.
6. Copie o valor gerado para `WEBHOOK_SECRET` (em forms-madm-api → Environment) — é esse valor que vai no header `X-Webhook-Secret` dos dois cenários do Make.

A partir daí, `https://forms-madm-api.onrender.com/webhook/collections` é a URL que você usa no módulo HTTP do Cenário A no Make.

> O plano gratuito do Render "dorme" depois de um tempo sem uso e demora alguns segundos para acordar na primeira chamada — se isso for um problema para o fluxo do CRM, migre para o plano pago mais barato (starter) mais adiante.

## Webhook de entrada — criar uma coleta

```bash
curl -X POST http://localhost:4000/webhook/collections \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <valor de WEBHOOK_SECRET no .env>" \
  -d '{
    "name": "Maria Oliveira",
    "phone": "11988887777",
    "email": "maria@example.com",
    "externalId": "id-do-lead-na-kommo",
    "expiresInDays": 7,
    "callbackUrl": "https://hook.make.com/xxxxxxxxxxxxx"
  }'
```

Resposta:

```json
{
  "collectionId": "...",
  "token": "...",
  "link": "http://localhost:5173/coleta/...",
  "expiresAt": "..."
}
```

- `externalId` é opcional, mas recomendado: se o mesmo `externalId` for enviado novamente, o sistema reaproveita o cliente já cadastrado em vez de duplicar.
- `callbackUrl` é opcional: se você não passar, o sistema simplesmente não notifica ninguém em tempo real (a coleta funciona normalmente, só sem o retorno automático pro Make).

## Callback de saída — eventos em tempo real

A cada documento enviado pelo cliente, e quando a coleta é concluída, a API faz um `POST` para o `callbackUrl` informado na criação:

```json
{
  "event": "media:uploaded",
  "collectionId": "...",
  "externalId": "id-do-lead-na-kommo",
  "clientName": "Maria Oliveira",
  "status": "IN_PROGRESS",
  "item": {
    "id": "...",
    "type": "ID_DOCUMENT",
    "title": "Documento de identificação",
    "status": "UPLOADED",
    "mediaId": "...",
    "downloadUrl": "https://SEU_DOMINIO/webhook/media/...",
    "mimeType": "image/png",
    "filename": "foto.png"
  },
  "timestamp": "2026-01-01T12:00:00.000Z"
}
```

Quando o último item obrigatório é enviado, chegam dois eventos em sequência: o último `media:uploaded` (já com `status: "COMPLETED"`) e logo depois um `collection:completed` (sem o campo `item`).

Essa chamada roda em segundo plano — se o Make demorar ou falhar ao responder, o upload do cliente não é afetado; a falha só fica registrada no log da API.

### Anexar o arquivo na Kommo (Cenário B)

O `downloadUrl` do evento **não é público** — para baixar o arquivo, o Make precisa mandar o mesmo header `X-Webhook-Secret` usado no Cenário A. No Cenário B, depois do gatilho "Custom Webhook":

1. Módulo **HTTP → Get a file**: URL = `{{item.downloadUrl}}` (do próprio corpo recebido), header `X-Webhook-Secret: <valor do .env>`. Esse módulo devolve o arquivo binário.
2. Módulo **amoCRM → Add a note/attachment to lead** (ou equivalente do conector Kommo no Make): `lead_id` = `{{externalId}}`, arquivo = o resultado do módulo 1.

Não guarde o arquivo no Data Store do Make — ele é feito para dados estruturados pequenos (texto/número/data), não para binários de foto/áudio/vídeo. O fluxo acima (baixar → anexar direto na Kommo) é o caminho compatível com qualquer tamanho de arquivo.

## Estrutura

```
apps/
  api/     # Express + Prisma — webhook + portal do cliente
  web/     # React + Vite — apenas o portal do cliente (/coleta/:token)
```

## Segurança

- O webhook exige o header `X-Webhook-Secret` — configure um valor forte e aleatório em produção (`openssl rand -hex 32`) e mantenha-o apenas no Make, nunca no CRM ou em lugares públicos.
- Tokens de coleta são gerados com `crypto.randomBytes(32)` e armazenados apenas como hash SHA-256 no banco.
- Uploads são validados por magic bytes (não apenas extensão/Content-Type).
- O disco persistente do Render guarda os arquivos entre deploys, mas para volumes grandes de uso considere migrar `StorageService` para S3/Cloudinary com URLs assinadas — a interface já foi feita pensando nessa troca.
