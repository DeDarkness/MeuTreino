# MeuTreino

Este repositório é uma PWA React pessoal para iPhone.

- Preserve a arquitetura local-first: nenhum login no app, Supabase, Expo ou código nativo. O serviço opcional de Web Push na Cloudflare guarda somente a inscrição do aparelho e os avisos agendados; treinos e histórico continuam locais.
- Dados de treino ficam no IndexedDB e precisam funcionar offline após o primeiro acesso.
- Cronômetros devem usar timestamps absolutos; não dependem apenas de `setInterval`.
- A interface é mobile-first, em português do Brasil, com alvos de toque de pelo menos 44 px e suporte às safe areas do iPhone.
- Preserve backup/importação antes de mudanças no esquema do banco.
- Rode `npm run typecheck`, `npm run lint` e `npm run build` antes de entregar mudanças.

- Preferência do João (19/10/2026): ao concluir cada etapa, salvar no Google Drive um relatório do que foi feito, arquivos e versões, verificações, publicação e pendências; verificar a presença na nuvem quando possível e informar quando houver apenas gravação local. Relatórios pessoais ficam no Drive, fora de repositórios públicos.
