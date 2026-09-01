# MeuTreino

Este repositório é uma PWA React pessoal para iPhone.

- Preserve a arquitetura local-first: nenhum login, servidor, Supabase, Expo ou código nativo.
- Dados de treino ficam no IndexedDB e precisam funcionar offline após o primeiro acesso.
- Cronômetros devem usar timestamps absolutos; não dependem apenas de `setInterval`.
- A interface é mobile-first, em português do Brasil, com alvos de toque de pelo menos 44 px e suporte às safe areas do iPhone.
- Preserve backup/importação antes de mudanças no esquema do banco.
- Rode `npm run typecheck`, `npm run lint` e `npm run build` antes de entregar mudanças.
