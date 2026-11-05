# Vaulty

Vaulty é uma aplicação web para uma empresa guardar e compartilhar informações em um workspace. O sistema combina uma interface React com uma API Java/Spring Boot, PostgreSQL e armazenamento de anexos compatível com S3. Inclui gerenciamento de membros, permissões, itens e pastas, anexos e compartilhamento de conteúdo.

## Acesso e compartilhamento

A aplicação implementa papéis globais fixos (Owner, Admin e Maintainer) sem time, e times com um Líder e uma coleção raiz. Membros comuns pertencem a no máximo um time e têm acesso uniforme à coleção associada; aceitar convite não concede acesso ao conteúdo. Publicações para outros times aparecem como projeções sincronizadas e somente leitura. O estado e os limites conhecidos estão em [docs/REQUISITOS.md](docs/REQUISITOS.md), [docs/MODELO-CONCEITUAL.md](docs/MODELO-CONCEITUAL.md) e nos diagramas HTML na raiz.

## Requisitos

- Git
- Docker com Docker Compose
- Java 17 ou superior
- Maven
- Node.js 22 ou superior
- pnpm 11.10 ou compatível
- OpenSSL para gerar as chaves locais

## Como rodar

### 1. Configurar e iniciar banco e storage

Na raiz do projeto:

```bash
cd server
cp .env.example .env
```

Edite `server/.env` e configure estas variáveis:

- `DB_USERNAME=vaulty`
- `DB_PASSWORD=vaulty`
- `JWT_SECRET`: chave aleatória com pelo menos 32 bytes
- `SECRET_ENCRYPTION_KEY`: chave Base64 aleatória de 32 bytes
- `GARAGE_RPC_SECRET` e `GARAGE_DEFAULT_SECRET_KEY`: valores aleatórios hexadecimais
- `GARAGE_DEFAULT_ACCESS_KEY`: valor começando com `GK`

Gere os valores localmente com:

```bash
openssl rand -base64 32
openssl rand -hex 32
printf 'GK'; openssl rand -hex 16
```

Use um valor Base64 para `JWT_SECRET` e outro para `SECRET_ENCRYPTION_KEY`; use dois valores hexadecimais para as variáveis `GARAGE_*SECRET*` e o valor iniciado por `GK` para `GARAGE_DEFAULT_ACCESS_KEY`. Não reutilize chaves reais nem as envie ao repositório.

Inicie PostgreSQL e Garage:

```bash
docker compose up -d
```

### 2. Iniciar a API

Em outro terminal, na raiz do projeto:

```bash
cd server
mvn spring-boot:run
```

A API ficará em <http://localhost:8080>. A interface Swagger fica em <http://localhost:8080/swagger-ui.html>.

Para habilitar convites e recuperação de senha por e-mail, configure as variáveis `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` e `MAIL_FROM` no arquivo `server/.env`.

### 3. Iniciar a aplicação web

Em outro terminal, na raiz do projeto:

```bash
cd web
cp .env.example .env
pnpm install
pnpm dev
```

Abra o endereço mostrado pelo Vite, normalmente <http://localhost:5173>.

Para parar PostgreSQL e Garage, execute `docker compose down` dentro de `server`. Os dados persistem nos volumes Docker; para apagá-los também, use `docker compose down -v`.

## Estrutura do projeto

- `web/`: frontend React, TypeScript e Vite.
- `server/`: API Spring Boot, migrações do banco e configuração Docker Compose.
- `docs/`: documentação funcional e técnica do projeto.
