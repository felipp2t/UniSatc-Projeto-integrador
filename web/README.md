# Rootly Web

Frontend do Rootly, construído com React, TypeScript e Vite.

## Desenvolvimento

Instale as dependências e copie o exemplo de variáveis de ambiente:

```bash
pnpm install
cp .env.example .env
pnpm dev
```

No Windows PowerShell, use `Copy-Item .env.example .env` no lugar de `cp`.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | Sim | URL base da API HTTP. Deve usar `http://` ou `https://`. |
| `VITE_WS_URL` | Não | URL do WebSocket. Quando definida, deve usar `ws://` ou `wss://`. |

`VITE_WS_URL` é opcional enquanto o cliente WebSocket não estiver implementado. Uma variável
ausente ou vazia não impede a inicialização; valores preenchidos com protocolo inválido causam
falha de configuração antes da renderização da aplicação.

Todas as variáveis com prefixo `VITE_` são públicas e ficam embutidas no bundle do navegador.
Nunca coloque senhas, tokens, chaves privadas ou outras credenciais nelas.

## Build

O build de produção é executado com:

```bash
pnpm build
```

Para visualizar o bundle localmente:

```bash
pnpm preview
```

Ao iniciar a aplicação, a configuração de ambiente é validada antes da renderização. A aplicação
exige `VITE_API_URL` e valida os protocolos das URLs configuradas.

## Qualidade

```bash
pnpm run check
```
