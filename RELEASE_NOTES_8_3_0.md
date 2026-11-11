# MeuTreino 8.3.0

## Gravação e recuperação

- A sessão, o histórico, a fila Dia D, os ajustes e a alimentação passam a refletir o estado confirmado pelo IndexedDB. As operações dependentes são canceladas se a gravação anterior falhar. Se duas instâncias 8.3.0 tentarem gravar a mesma revisão, só a primeira grava. A outra pode reabrir os dados salvos.
- Alterações destrutivas ou de substituição guardam uma única cópia do estado anterior, na mesma transação. Em Ajustes é possível preparar, exportar ou restaurar a cópia com confirmação. A tela de erro de carregamento também oferece recuperação por backup.
- O JSON mantém o formato 1, agora com SHA-256 quando Web Crypto está disponível. Backups antigos sem esse campo passam por validação estrutural. Backups antigos que trazem apenas treinos preservam a alimentação atual.
- O prazo do descanso permanece absoluto. A retomada reconcilia o prazo ao voltar à página. Um callback de um prazo anterior não encerra o descanso que foi estendido ou iniciado depois.
- O download mantém a URL temporária ativa por um minuto. PDF e JSON são preparados antes do toque que abre o compartilhamento. [WebKit sobre download de blobs](https://bugs.webkit.org/show_bug.cgi?id=211234) e [ativação por gesto no WebKit](https://webkit.org/blog/13862/the-user-activation-api/).

## No uso diário

- Na sessão, **Concluir com os valores do último treino** copia carga, repetições e RIR da série correspondente e registra tudo numa gravação.
- A progressão sugere uma repetição adicional dentro da faixa quando carga e RIR são comparáveis. Para sugerir um aumento de carga, considera o topo da faixa, a reserva e uma segunda sessão na mesma carga quando disponível. A aplicação depende de toque explícito.
- Evolução mostra oito semanas de sessões, séries e volume com carga. O volume soma carga × repetições. A aderência conta cada ficha A/B/C normal uma vez na semana de início, inclusive sessões parciais. Dia D entra nos totais realizados sem contar como uma ficha A/B/C adicional. A meta reflete as fichas existentes no momento da consulta.
- Peso e medidas corporais têm tendências a partir dos registros disponíveis. No ciclo, escolha de 1 a 16 semanas e marque semanas de recuperação como anotações no calendário.
- Em Alimentação, repita refeições já registradas ou salve uma favorita. O lançamento usa porções e valores nutricionais da origem. As quantidades continuam editáveis.
- No histórico, a opção **Incluir gráficos e indicadores** acrescenta a visão semanal da seleção ao PDF gerado no aparelho. As sessões detalhadas continuam no arquivo.
- Em **Evolução → Histórico**, filtre pelo Full Body completo, por A/B/C ou pelo Dia D. **Comparar dois treinos** mostra carga, repetições e RIR por série em duas sessões da mesma ficha. A opção de gráficos continua marcada ao editar a seleção de sessões para PDF.
- Ao encerrar um treino, o resumo mostra as séries pendentes na semana de origem, mesmo quando falta só uma. **Ver Dia D** abre a semana correspondente. O atalho some quando essa semana fica sem pendências.

## Compatibilidade e atualização

React, TypeScript, Vite, IndexedDB e Workbox permanecem. O banco continua na versão 2 e os dados e backups no formato 1. A revisão é um campo adicional do registro local. As fichas A/B/C e as regras do Dia D seguem as mesmas. As telas secundárias são carregadas sob demanda e os arquivos necessários já fazem parte do cache offline da versão.

1. Na versão instalada, exporte o JSON e confirme que está no app Arquivos. Wallpaper e inscrição Web Push ficam fora do JSON.
2. Encerre a sessão ativa e feche outras janelas do MeuTreino. Depois que a nova versão estiver publicada, abra o mesmo ícone e toque em **Atualizar** quando aparecer.
3. Confirme a versão em Ajustes e confira histórico, alimentação e Dia D. Se precisar restaurar, use **Ajustes → Importar backup** após conferir o arquivo e ler a confirmação.
4. Para verificar Safari, instalação, compartilhamento e Web Push, siga o [checklist manual](docs/TESTE-SAFARI-8.3.0.md).
