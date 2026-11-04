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

### Storage S3 compatível

O adaptador de runtime desta aplicação usa S3 (`app.storage.s3.*`). Faça a verificação em bucket descartável vazio, separado do bucket da instalação, e use credenciais com acesso somente a esse destino. A CLI `aws` deve estar instalada e configurada para esse destino; para S3 compatível, `S3_ENDPOINT` deve apontar para o endpoint descartável. Não configure a aplicação restaurada para acessar o storage original.

Com `WORK` já extraído e inventário validado, defina o bucket e, se aplicável, o endpoint. Cada arquivo local é enviado para o `storageKey` literal do manifest, sem derivar a chave do nome ou do ID. O script também baixa cada objeto enviado e compara tamanho e SHA-256 com o arquivo do ZIP:

```sh
export RESTORE_BUCKET='bucket-descartavel-vazio'
# Opcional para S3 compatível; omita para AWS S3.
export S3_ENDPOINT='https://endpoint-descartavel'

python3 - "$WORK" <<'PY'
import hashlib, json, os, pathlib, subprocess, sys, tempfile

root = pathlib.Path(sys.argv[1]).resolve()
manifest = json.loads((root / "manifest.json").read_text())
bucket = os.environ["RESTORE_BUCKET"]
endpoint = os.environ.get("S3_ENDPOINT")
global_args = ["--endpoint-url", endpoint] if endpoint else []

with tempfile.TemporaryDirectory(dir=root) as temporary:
    for entry in manifest["attachments"]:
        relative = pathlib.Path(entry["path"])
        source = (root / relative).resolve()
        assert source.is_relative_to(root) and relative.parts[0] == "attachments", entry["path"]
        assert relative.parts == ("attachments", entry["id"]), entry["path"]
        data = source.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        assert len(data) == entry["sizeBytes"] and digest == entry["sha256"], entry["id"]
        uri = f"s3://{bucket}/{entry['storageKey']}"
        subprocess.run(["aws", *global_args, "s3", "cp", str(source), uri, "--only-show-errors"], check=True)
        restored = pathlib.Path(temporary) / entry["id"]
        subprocess.run(["aws", *global_args, "s3", "cp", uri, str(restored), "--only-show-errors"], check=True)
        restored_data = restored.read_bytes()
        assert len(restored_data) == entry["sizeBytes"]
        assert hashlib.sha256(restored_data).hexdigest() == entry["sha256"], entry["id"]
        print(f"OK: id={entry['id']} storageKey={entry['storageKey']} size={len(data)} sha256={digest}")
PY
```

Depois do upload, configure a instância isolada para usar o banco restaurado, o mesmo bucket/endereço descartável e a chave original via `SECRET_ENCRYPTION_KEY`. Inicie uma única instância e faça as verificações abaixo. A coluna `item_file.storage_key` preservada pelo dump aponta para a chave literal restaurada. Não use `aws s3 sync` para espelhar o bucket original nem restaure sobre um destino que contenha objetos a preservar.

O exemplo acima cobre o adaptador S3 com CLI externa; ela não é instalada pelo Vaulty. Um storage diferente exige comandos e procedimento próprios para o serviço em uso. Nunca aponte a verificação para o bucket ou diretório real.

Configure a aplicação de verificação para usar exclusivamente o banco e o storage descartáveis, forneça a chave original por `SECRET_ENCRYPTION_KEY`, inicie uma única instância e confira:

1. Itens, pastas e vínculos do banco foram restaurados.
2. Os anexos abrem com seus bytes esperados e cada vínculo do item resolve para o `storageKey` inventariado.
3. Um usuário autorizado consegue consultar um segredo de teste e recebe o valor esperado.
4. Um usuário sem a permissão correspondente é negado ao consultar esse segredo.

Registre a versão do PostgreSQL/aplicação, identificação do pacote, resultado de cada hash, banco e storage descartáveis utilizados, evidência dos dois resultados de acesso e falhas/ajustes. Só declare a cópia recuperável após esses passos. Sem teste autorizado e negado pela API contra o banco restaurado, ou sem restauração de storage real descartável, RNF16-CA04 permanece sem comprovação completa.

## Evidências disponíveis desta implementação

Em 2026-11-04 UTC, foi executado novamente o teste de integração de backup/restauração com Maven 3.9.11 e Java 21.0.9, usando o POM atual, PostgreSQL 17 e as imagens Maven, PostgreSQL e Ryuk já existentes localmente. Comando: `mvn -B -Dmaven.repo.local=/m2 -Dtest=WorkspaceBackupServiceIntegrationTest -f server/pom.xml verify`. Resultado: `BUILD SUCCESS`; 3 testes, 0 falhas, 0 erros e 0 ignorados (relatório Surefire). O teste gerou um ZIP por `WorkspaceBackupService`, validou formato custom, inventário, tamanhos, hashes, ID, caminho e bytes do anexo; restaurou o dump em outro banco PostgreSQL 17 descartável e o objeto em filesystem descartável separado, sob o `storageKey` do manifest. Com o banco e filesystem restaurados, iniciou um contexto real da aplicação com a chave fixture original: consulta do segredo pelo dono retornou 200 e o valor esperado; consulta pelo membro sem permissão retornou 403; download do anexo pelo dono retornou 200 e os bytes esperados. A fixture também verificou o vínculo item↔storageKey e que o valor cifrado no banco não é texto em claro. Outros dois testes da classe confirmaram cleanup/liberação do gate após falha e interrupção de `pg_dump`.

Essa execução testa o adaptador filesystem da fixture, não AWS S3 nem MinIO; para validar uma instalação com S3, repita o procedimento anterior contra bucket descartável real do serviço e registre separadamente os resultados. O teste é limitado aos dados sintéticos da fixture; não representa cópia ou credenciais de usuário. O ZIP não contém a chave. A chave de teste nunca deve ser reutilizada fora de testes.

Em 2026-10-27, após as regressões de revisão, `mvn -B verify` reportou BUILD SUCCESS com 179 testes, zero falhas/erros/skips. `WorkspaceBackupServiceIntegrationTest` gerou o ZIP pelo serviço real usando `pg_dump` 17 e um `ObjectStorage` de filesystem temporário; validou formato custom do dump, manifest, tamanhos, hashes, IDs, caminhos e bytes do anexo. Restaurou o dump em outro banco PostgreSQL 17 descartável e os bytes do anexo em outra raiz temporária, preservando o `storageKey` inventariado.

Com esse banco e filesystem restaurados, iniciou um contexto real da aplicação configurado com a mesma chave original de teste e consultou a API: o dono recebeu `200` e o valor esperado do segredo; o membro sem permissão recebeu `403`; o dono baixou o anexo e recebeu os bytes esperados. O mesmo contexto executou `POST /vaulty/workspaces/backup` autenticado com `contextPath=/vaulty` e `servletPath=/workspaces/backup`, sem mock do serviço, e recebeu ZIP; isso verifica que a rota de backup não tenta adquirir a própria lease de writer. Também conferiu o vínculo item↔arquivo restaurado, que o segredo permanece cifrado no banco, a limpeza dos temporários e a liberação da pausa após falha. Teste de interrupção controlada confirmou que o processo pg_dump termina antes da liberação do gate/temporários e que a flag de interrupção é restaurada. As regressões do filtro confirmam que aliases e trailing slash continuam bloqueados durante backup. Essas verificações descartáveis atendem à verificação de banco, storage e autorização prevista em RNF16-CA04 para os fixtures usados.

O teste usou filesystem descartável, não um serviço S3 compatível; portanto, compatibilidade específica com S3/MinIO não foi exercitada. A chave usada foi fixture de teste e não deve ser reutilizada fora dos testes. O ZIP não contém a chave criptográfica.

O ZIP contém inventário e dump, mas não inclui a chave criptográfica. A recuperação pode trazer de volta registros excluídos depois da data do backup; isso difere de restaurar itens arquivados pela interface.
