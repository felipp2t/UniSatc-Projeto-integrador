# Backup manual e recuperação — contrato e procedimento

Encaminhamento L10 autorizado e detalhes técnicos aprovados em 12/10/2026, relacionado a RF48/RNF16. Este documento prepara a implementação e a verificação; não declara backup implementado nem restauração executada.

## Contrato da cópia

- Um único pacote para download, com identificação da versão do formato e um inventário de seu conteúdo.
- Incluir uma cópia consistente do banco e os anexos correspondentes, preservando IDs e vínculos.
- Inventário identifica data/hora, versão da aplicação/formato, arquivos e informações necessárias para detectar uma cópia incompleta.
- Documentar qual material de criptografia é necessário para recuperar os segredos e como o operador o fornece. Não presumir que banco e anexos, sozinhos, permitam decifrá-los ou que a chave deva ser colocada em claro no pacote.
- Geração manual, restrita aos donos; nenhuma retenção, agendamento ou guarda externa é administrada pelo Vaulty.

O contrato aprovado usa ZIP com manifest.json (formato 1, data/hora, versão da aplicação, identificação/tamanhos/hashes SHA-256), database.dump custom do PostgreSQL e attachments/. A geração é única na instalação local, com gravações pausadas após aguardar as já iniciadas; consultas permanecem disponíveis. A pausa inclui processos de fundo que alterem dados/anexos e é liberada em sucesso ou falha.

A chave original é fornecida pela configuração do operador e não vai em claro no ZIP. Sem ela, o banco restaurado não permite recuperar os valores secretos. O [contrato técnico](./DETALHES-TECNICOS.md) detalha essas decisões; os comandos concretos ainda dependem de implementar RF48 e o storage. Não há comandos executáveis inventados neste procedimento.

## Sequência de recuperação a operacionalizar

1. Identificar o pacote e a versão compatível da aplicação; conferir o inventário e sua completude.
2. Preparar banco e storage descartáveis, separados dos dados em uso, para a verificação inicial.
3. Fornecer o material criptográfico necessário pelo mecanismo documentado da aplicação.
4. Restaurar banco e anexos do mesmo ponto consistente, preservando IDs e vínculos.
5. Iniciar a aplicação no ambiente descartável e verificar itens, pastas, anexos e regras de acesso.
6. Conferir consulta autorizada de um segredo de teste e negativa para um membro sem essa permissão.
7. Registrar pacote usado, ambiente, resultados, falhas e ajustes; só então declarar a cópia recuperável.

Restaurar o histórico do banco pode trazer registros de recursos que haviam sido excluídos depois do momento da cópia; isso é recuperação técnica, distinta de restaurar itens arquivados pela interface. O procedimento não acrescenta botão de restauração.

## Situação e evidências

Ainda não executado. O contrato e a sequência estão aprovados; pré-requisitos e comandos concretos devem ser completados depois que RF48 existir. A aprovação de L10 autoriza preparar e verificar o procedimento, mas não fornece uma evidência de restauração bem-sucedida.
