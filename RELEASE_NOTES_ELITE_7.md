# MeuTreino Elite 7.0.2

## Ajuste da segunda-feira (7.0.2)
- Pallof press substituído por Crunch abdominal na polia no Full Body A: 2 séries de 10–15 repetições, 60 s de descanso e RIR 2 na ficha padrão.
- Migração pontual das fichas já instaladas: preserva os demais exercícios, parâmetros personalizados e histórico. Não interrompe sessão em andamento. Um novo identificador evita herdar a carga do Pallof; registros anteriores de crunch podem ser reutilizados normalmente.

## Treino e evolução
- Progressão exige todas as séries, topo da faixa, carga comparável e RIR registrado adequado à prescrição. Ausência de RIR não é tratada como autorização para subir peso.
- Incrementos conservadores de até 5%, com passo de equipamento editável por exercício, em kg. Sugestões nunca alteram cargas automaticamente.
- Estimativa de força limitada a séries de 1–12 repetições, explicitamente identificada como estimativa.
- Apenas treino normal, sem seletor Express na tela inicial, fichas ou painel semanal. Sessões novas usam todas as séries da ficha; preferências Express antigas são ignoradas. Histórico e sessões antigas continuam compatíveis, sem reescrita dos registros.
- Volume realizado separado do planejado, com navegação por semana, contagem de sessões e séries por músculo dominante. Registros novos guardam o músculo da sessão; dados antigos ambíguos não são classificados por suposição.
- Resumo compara volumes apenas com sessões do mesmo modo e configuração equivalente.
- Revisar uma série já concluída não a transforma na próxima série anunciada pelo descanso.

## Experiência
- Nova hierarquia visual Elite, painel semanal expansível, números alinhados, controles grandes e melhor contraste.
- Busca de fichas/exercícios sem acentos; versões arquivadas separadas da lista principal e ainda acessíveis.
- Histórico pesquisável por treino, exercício ou anotação, com filtros de 30/90 dias.
- Campos permitem apagar e redigitar, vírgula decimal e cargas como 82,25 kg; o passo dos botões não arredonda o valor digitado.
- Editor só fecha após confirmação de gravação; erros mantêm as edições visíveis e evitam submissão dupla.
- Feedback de gravação e modo offline. Interface do cronômetro atualiza uma vez por segundo e pausa repinturas em segundo plano, preservando timestamps absolutos e Web Push.
- Controle de redução de movimento, preferência de acessibilidade do sistema respeitada e vídeo pausado quando o app está oculto. GIFs são ocultados no modo reduzido.
- Leitores de tela não recebem o contador do descanso como um anúncio a cada segundo. Foco contido e restaurado no resumo final.

## Proteção e atualização
- Cópia local anterior feita atomicamente com operações de importação, exclusão de ficha/registro e migração inicial. Exportação disponível nos Ajustes.
- JSON validado antes de substituir os dados; novos metadados opcionais mantêm compatibilidade com backups antigos. Sem reset de fichas ou histórico.
- Apagar todos os dados também remove a cópia de segurança local. Wallpaper segue fora do backup JSON, claramente informado.
- Atualização por confirmação, bloqueada durante sessão ativa; sem recarregamento forçado na nova política.
- Dependências transitivas de desenvolvimento corrigidas pela auditoria, sem atualização forçada de versões principais.

## Limites preservados
PWA local-first, sem conta, mensalidade ou sincronização. Notificações precisam de internet e seguem som/Foco/permissões do iPhone; não foi prometido áudio personalizado em segundo plano. Verificação em navegador e testes automatizados não substituem teste em um iPhone físico.
