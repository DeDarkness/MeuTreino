# MeuTreino 8.4.0

## Full Body V-Taper

Em **Ajustes → Protocolos de treino**, escolha a ficha original de 66 séries, a etapa gradual de 70 ou a ficha completa de 74. A mudança é confirmada no app e arquiva fichas A/B/C editadas. A ficha completa tem 24 séries no A, 26 no B e 24 no C. Puxada neutra e remada unilateral iniciam A e C. Uma série unilateral inclui os dois lados.

O Início mostra as últimas cargas de puxada e remada e as medidas registradas. O Histórico conserva o comparador de sessões, o PDF seletivo e os gráficos de treino. Os novos registros incluem a quantidade planejada de séries e o descanso da ficha.

## Medidas, fotos e cópias

- Em **Evolução**, salve avaliações parciais, edite ou exclua avaliações por ID e compare duas datas ou horários. O módulo mantém as medidas antigas com seus nomes originais.
- Em **Evolução → Evolução fotográfica**, use câmera ou galeria, escolha uma pose e associe a uma avaliação. Compare fotos lado a lado, com divisor ou por opacidade. A miniatura do Início depende de opção explícita em Ajustes.
- Em **Ajustes → Backup ZIP**, marque **Incluir arquivos das fotos** para levar as imagens. A restauração oferece prévia e permite adicionar registros ausentes. O JSON antigo continua disponível. O arquivo ZIP tem limite de 150 MB.
- O diário de alimentação existente está em **Ajustes → Consultar e exportar alimentação anterior**.

O IndexedDB passa da versão 2 para a 3 e cria apenas o armazenamento de fotos. As fichas, os registros e os ajustes existentes ficam na mesma origem do GitHub Pages. Para atualizar, use o mesmo ícone instalado após salvar seu backup. Se uma janela antiga bloquear a migração, feche as outras instâncias do MeuTreino.

## Supabase

A migração de tabelas e bucket privado está disponível para um projeto Supabase de teste. A 8.4.0 funciona com os dados no aparelho. Login, fila de sincronização e reconciliação entre dispositivos dependem da próxima etapa de integração e verificação no serviço. [Configuração e testes](docs/SUPABASE-EVOLUCAO.md)
