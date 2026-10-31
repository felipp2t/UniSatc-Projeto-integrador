# API

## Gerar backup do workspace

`POST /workspaces/backup` gera sob demanda um único pacote ZIP do workspace. Requer autenticação e papel de dono; membros recebem `403`, mesmo que possam consultar ou compartilhar conteúdo. O endpoint não aceita corpo. Durante a geração, consultas continuam disponíveis e requisições mutativas recebem `409` com orientação para tentar depois que o backup terminar. Apenas uma geração pode ocorrer por vez nesta instalação local.

### Sucesso

- `200 OK`
- `Content-Type: application/zip`
- `Content-Disposition: attachment; filename="vaulty-backup.zip"`
- Corpo: bytes do ZIP. O nome do arquivo é fixo.

O frontend deve tratar a resposta como `Blob` e iniciar o download usando o nome recebido em `Content-Disposition` (com `vaulty-backup.zip` como fallback). Em respostas diferentes de `2xx`, não salvar o corpo como ZIP: ler o JSON de erro e informar que a geração não foi concluída e pode ser tentada novamente. A interface deve disponibilizar o acionamento somente ao dono; a autorização no servidor continua obrigatória.

### Erros

| HTTP | Quando | Tratamento esperado no frontend |
| --- | --- | --- |
| `401` | Sessão ausente ou inválida | Encaminhar ao fluxo de autenticação existente. |
| `403` | Usuário autenticado não é dono | Informar falta de autorização; não oferecer arquivo. |
| `409` | Outro backup está ativo ou uma gravação foi bloqueada pela pausa | Informar que há manutenção/backup em andamento e permitir nova tentativa após a pausa. |
| `503` | Falha ao gerar o pacote, inclusive falha do dump ou leitura de anexo | Informar que o backup não foi concluído e permitir nova tentativa. A pausa e os temporários são liberados/removidos em falha. |

Os erros tratados pela API usam `application/json` e o formato geral `{"timestamp":"...","status":403,"error":"Forbidden","message":"...","path":"/workspaces/backup"}`. Mensagem e timestamp podem variar. A resposta `409` da barreira de gravações usa `{"message":"Backup em andamento; tente novamente depois"}`. O cliente deve basear o fluxo no status HTTP, não na mensagem literal.

### Conteúdo do ZIP

Entradas na raiz:

- `manifest.json`
- `database.dump` — formato custom do PostgreSQL.
- `attachments/<itemId>` — bytes do anexo identificado pelo UUID do item.

`manifest.json` tem formato 1 e estas propriedades:

```json
{
  "formatVersion": 1,
  "createdAt": "2026-10-27T12:34:56.789Z",
  "applicationVersion": "1.0.0",
  "workspaceId": "00000000-0000-0000-0000-000000000000",
  "database": {
    "path": "database.dump",
    "sizeBytes": 12345,
    "sha256": "<64 caracteres hexadecimais minúsculos>"
  },
  "attachments": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "storageKey": "chave-original-no-storage",
      "path": "attachments/00000000-0000-0000-0000-000000000001",
      "sizeBytes": 42,
      "sha256": "<64 caracteres hexadecimais minúsculos>"
    }
  ]
}
```

O exemplo ilustra o esquema, não valores garantidos: `createdAt` é UTC ISO-8601, `applicationVersion` pode ser `unknown`, `sizeBytes` é o tamanho em bytes, hashes são SHA-256 hexadecimais e `attachments` pode ser vazio. A chave de criptografia da aplicação não faz parte do ZIP. A geração requer `pg_dump` 17 disponível no `PATH` do processo da aplicação e permissão para executá-lo e escrever temporários; em produção, o caminho de execução do runtime precisa ser configurado separadamente do PATH usado pelos testes.

## Pausa durante a geração

O servidor permite apenas uma geração por vez na instância local. Ela aguarda escritores já admitidos, pausa novas mutações e processos de fundo que escrevem, mantendo `GET`, `HEAD` e `OPTIONS` disponíveis. Mutações negadas recebem `409`; o cliente deve permitir nova tentativa após a conclusão. A pausa é liberada em sucesso ou falha. O gate é em memória, portanto não coordena múltiplas instâncias da aplicação.
