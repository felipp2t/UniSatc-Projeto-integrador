# Backup manual e recuperação

Este procedimento é técnico; não há botão de restauração. Faça a primeira verificação em banco e storage descartáveis, isolados dos dados em uso. A recuperação só deve ser declarada depois de concluir as verificações RNF16-CA04 descritas abaixo.

## Requisitos operacionais

- Use PostgreSQL 17 para validar/restaurar o dump. O runtime da aplicação que gera o backup também precisa encontrar `pg_dump` 17 no próprio `PATH` e ter permissão para executá-lo, conectar ao banco configurado e criar/escrever arquivos temporários. O PATH adicionado pelo Surefire aos testes não configura o processo em produção. Confira no mesmo usuário/contêiner e ambiente do runtime:

  ```sh
  command -v pg_dump
  pg_dump --version
  test -x "$(command -v pg_dump)"
  ```

- O gate de manutenção é em memória e protege uma instância local. Execute a geração com uma única instância da aplicação; ele não coordena réplicas/múltiplas instâncias.
- Guarde fora do pacote e forneça na configuração do ambiente restaurado a mesma chave original usada para cifrar os segredos: `SECRET_ENCRYPTION_KEY` (propriedade `app.secret-encryption-key`). Não a escreva em comandos salvos, logs, ZIP ou repositório. Sem a chave original, não declare os valores secretos recuperáveis.
- O Vaulty não mantém retenção do ZIP. O operador guarda o arquivo baixado e administra a cópia e os temporários criados durante a recuperação.

## Verificar o pacote

Os comandos abaixo pressupõem `BACKUP` apontando para o ZIP e `WORK` para um diretório novo, vazio e descartável. Não extraia um pacote não confiável como usuário privilegiado: examine as entradas antes e mantenha a extração dentro do diretório de trabalho.

```sh
export BACKUP=/caminho/vaulty-backup.zip
export WORK="$(mktemp -d)"
unzip -t "$BACKUP"
unzip -q "$BACKUP" -d "$WORK"
```

Conferir as versões e cada tamanho/hash SHA-256 do inventário:

```sh
python3 - "$WORK" <<'PY'
import hashlib, json, pathlib, sys

root = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((root / "manifest.json").read_text())
assert manifest["formatVersion"] == 1, manifest["formatVersion"]
assert manifest["applicationVersion"], "applicationVersion ausente"
entries = [manifest["database"], *manifest["attachments"]]
for entry in entries:
    path = (root / entry["path"]).resolve()
    assert path.is_relative_to(root), entry["path"]
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    assert len(data) == entry["sizeBytes"], f"tamanho divergente: {entry['path']}"
    assert digest == entry["sha256"], f"SHA-256 divergente: {entry['path']}"
print(f"OK: formato 1, {len(manifest['attachments'])} anexos, hashes e tamanhos conferidos")
PY
```

Revise também que cada `attachments[].path` é `attachments/<id>` e que `id`, `storageKey` e o vínculo do banco correspondem. O verificador confirma apenas integridade em relação ao próprio manifest; não prova que o conteúdo está correto, completo ou restaurável.

## Restaurar em destinos descartáveis

Confirme `pg_restore --version` com PostgreSQL 17. Crie um banco descartável vazio; não use um banco em produção nem um banco que contenha dados a preservar. Com um servidor PostgreSQL 17 local, por exemplo:

```sh
pg_restore --version
createdb --template=template0 vaulty_restore_check
pg_restore --exit-on-error --no-owner --dbname=vaulty_restore_check "$WORK/database.dump"
```

Se houver erro, interrompa a verificação e descarte o banco de teste. O dump é custom PostgreSQL e foi gerado com `--no-owner`; use um banco compatível e permissões apropriadas.

Restaure os anexos no storage descartável configurado para a instância de verificação. Para cada objeto de `manifest.attachments`, os bytes estão em `WORK/<path>` e devem ser gravados sob exatamente o `storageKey`; a coluna/tabela de metadados do banco contém a relação entre item e arquivo. Não derive ou renomeie a chave a partir do nome do arquivo: mantenha `id`, `storageKey` e vínculo conforme manifest e dump. Use o adaptador/configuração do storage da instalação. Nunca aponte o procedimento de teste ao bucket ou diretório real.

Configure a aplicação de verificação para usar exclusivamente o banco e o storage descartáveis, forneça a chave original por `SECRET_ENCRYPTION_KEY`, inicie uma única instância e confira:

1. Itens, pastas e vínculos do banco foram restaurados.
2. Os anexos abrem com seus bytes esperados e cada vínculo do item resolve para o `storageKey` inventariado.
3. Um usuário autorizado consegue consultar um segredo de teste e recebe o valor esperado.
4. Um usuário sem a permissão correspondente é negado ao consultar esse segredo.

Registre a versão do PostgreSQL/aplicação, identificação do pacote, resultado de cada hash, banco e storage descartáveis utilizados, evidência dos dois resultados de acesso e falhas/ajustes. Só declare a cópia recuperável após esses passos. Sem teste autorizado e negado pela API contra o banco restaurado, ou sem restauração de storage real descartável, RNF16-CA04 permanece sem comprovação completa.

## Evidências disponíveis desta implementação

Em 2026-10-27, após as regressões de revisão, `mvn -B verify` reportou BUILD SUCCESS com 179 testes, zero falhas/erros/skips. `WorkspaceBackupServiceIntegrationTest` gerou o ZIP pelo serviço real usando `pg_dump` 17 e um `ObjectStorage` de filesystem temporário; validou formato custom do dump, manifest, tamanhos, hashes, IDs, caminhos e bytes do anexo. Restaurou o dump em outro banco PostgreSQL 17 descartável e os bytes do anexo em outra raiz temporária, preservando o `storageKey` inventariado.

Com esse banco e filesystem restaurados, iniciou um contexto real da aplicação configurado com a mesma chave original de teste e consultou a API: o dono recebeu `200` e o valor esperado do segredo; o membro sem permissão recebeu `403`; o dono baixou o anexo e recebeu os bytes esperados. O mesmo contexto executou `POST /vaulty/workspaces/backup` autenticado com `contextPath=/vaulty` e `servletPath=/workspaces/backup`, sem mock do serviço, e recebeu ZIP; isso verifica que a rota de backup não tenta adquirir a própria lease de writer. Também conferiu o vínculo item↔arquivo restaurado, que o segredo permanece cifrado no banco, a limpeza dos temporários e a liberação da pausa após falha. Teste de interrupção controlada confirmou que o processo pg_dump termina antes da liberação do gate/temporários e que a flag de interrupção é restaurada. As regressões do filtro confirmam que aliases e trailing slash continuam bloqueados durante backup. Essas verificações descartáveis atendem à verificação de banco, storage e autorização prevista em RNF16-CA04 para os fixtures usados.

O teste usou filesystem descartável, não um serviço S3 compatível; portanto, compatibilidade específica com S3/MinIO não foi exercitada. A chave usada foi fixture de teste e não deve ser reutilizada fora dos testes. O ZIP não contém a chave criptográfica.

O ZIP contém inventário e dump, mas não inclui a chave criptográfica. A recuperação pode trazer de volta registros excluídos depois da data do backup; isso difere de restaurar itens arquivados pela interface.
