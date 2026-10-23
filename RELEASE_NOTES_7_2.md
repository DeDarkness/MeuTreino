# MeuTreino Elite 7.2.0 — reposição semanal

## Uso

1. Inicie uma ficha normal A/B/C. Não há encerramento automático em 90 minutos ou na virada da meia-noite.
2. Quando precisar parar, toque em **Encerrar e guardar pendências**. A confirmação informa séries feitas e restantes, inclusive exercícios pulados.
3. Só séries concluídas são registradas; encerrar com zero séries não gera histórico.
4. No **Início → Reposição da semana**, selecione a semana de origem, os exercícios e quantas séries deseja fazer. Pendências de semanas anteriores são identificadas, sem incorporá-las automaticamente ao plano atual.
5. Toque em **Iniciar reposição selecionada**. A origem fica reservada na fila até o encerramento ser gravado. Concluídas são descontadas; não feitas permanecem. Abandonar mantém a fila original e não registra a tentativa.
6. Se uma ficha inteira não foi realizada, escolha-a no Início e use **Não fiz esta ficha · guardar para repor**. Há confirmação e proteção contra duplicação na mesma semana. Uma nova ficha completa pode ser iniciada explicitamente mesmo com pendências, mediante aviso.
7. Descarte pendências que não deseja repor com confirmação. Não é obrigatório completar o volume pendente.

## Integridade e compatibilidade

- IndexedDB local, mesmo esquema/versão do banco; novos campos opcionais preservam backups antigos.
- Origem estável por item e série: ficha, sessão, semana local (segunda a domingo), exercício, número original da série e metas. Sessões parciais repetidas não criam uma “reposição de reposição”.
- IDs de execução distintos evitam que exercícios iguais de duas origens sejam editados juntos. Superséries não são recriadas automaticamente com grupos parciais.
- Encerrar/abandonar, iniciar/descartar reposição e registrar ficha não realizada aguardam gravação antes de publicar o novo estado na tela. Falha mantém a sessão e a fila anteriores; operações concorrentes ficam bloqueadas enquanto essa gravação termina.
- Cópia anterior local antes dessas operações. Backup/exportação e importação validada incluem pendências, reservas e histórico. Wallpaper e inscrição Push continuam fora do JSON.
- Fila: até 200 itens. Sessão de reposição: até 18 séries no total e 12 do mesmo exercício; uma semana por sessão. São limites técnicos, não metas ou prescrição. Um exercício personalizado com mais séries pode ser dividido entre sessões.
- Fila cheia não bloqueia permanentemente o encerramento: é possível voltar ao Início, descartar itens não reservados e tentar novamente, preservando a sessão ativa.
- Painel semanal conta somente séries realizadas na semana de conclusão. Sessões parciais/reposições são registros, não um contador artificial “3 de 3”. Pendências não aumentam o denominador do plano nem são consideradas realizadas.
- O histórico de reposição mostra a semana de origem. Não reescreve registros antigos nem altera as fichas por causa da reposição.

## O que não mudou

- A/B/C normal: 22/23/21 = 66 séries semanais, sem Express. Nenhuma carga pessoal foi inventada.
- TXT fixo na Área de Trabalho permanece idêntico porque a prescrição não mudou.
- Descanso não bloqueante, timestamps absolutos, som local, Web Push, wallpaper e funcionamento offline continuam com a arquitetura existente.
- Não há sincronização de treinos com PC/servidor nem promessa de leitura dos dados locais do iPhone. Notificações remotas continuam dependendo de internet, autorização e entrega pelo sistema do aparelho.
