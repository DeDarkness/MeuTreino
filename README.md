# MeuTreino

MeuTreino é uma PWA pessoal de academia feita para ser instalada na Tela de Início do iPhone. Não usa Expo, App Store, Apple Developer, conta, Supabase ou servidor. Treinos, cargas e histórico ficam no IndexedDB do próprio aparelho.

## Recursos

- Criar, editar, duplicar e excluir fichas.
- Exercícios com séries, repetições, carga, descanso e observações.
- Execução série a série, reaproveitando a última carga e repetições registradas.
- Cronômetro de descanso com `+15 s`, pular, som e vibração.
- Screen Wake Lock para manter a tela ligada durante o treino quando o iOS permitir.
- Sessão ativa restaurada após fechar ou recarregar o app.
- Histórico detalhado por exercício e série.
- Funcionamento offline depois do primeiro carregamento.
- Backup e restauração em arquivo JSON.
- Atualização automática pelo GitHub Pages.

## Instalar no iPhone

Depois que o site estiver publicado:

1. Abra o endereço no Safari.
2. Toque em **Compartilhar**.
3. Escolha **Adicionar à Tela de Início**.
4. Ative **Abrir como App** e toque em **Adicionar**.

O ícone MeuTreino aparecerá na Tela de Início e abrirá em janela própria. O primeiro acesso precisa de internet para baixar e guardar os arquivos; depois o app abre offline.

> O alerta sonoro de descanso é confiável enquanto o MeuTreino está visível. Se o iPhone for bloqueado ou o app ficar em segundo plano, o iOS pode suspender o JavaScript. O app recalcula o tempo restante quando volta ao primeiro plano, mas não consegue garantir um som no instante exato enquanto estiver suspenso.

## Rodar no computador durante o desenvolvimento

Pré-requisitos: Node.js 20.19 ou superior e npm.

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal. Para simular a largura de um iPhone, use o modo responsivo das ferramentas do navegador.

## Validar

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

O build estático é gerado em `dist/`.

## Publicar gratuitamente no GitHub Pages

O workflow [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml) compila e publica cada atualização enviada para `main`.

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment**, selecione **GitHub Actions**.
3. Envie um commit para `main` ou execute o workflow manualmente.

No plano GitHub Free, Pages exige que o repositório seja público. Isso deixa o código visível, mas não publica os treinos: os dados pessoais continuam somente no IndexedDB do iPhone. Se o repositório continuar privado, é necessário GitHub Pro ou outro serviço de hospedagem estática gratuita conectado ao repositório.

O endereço padrão deste projeto será:

```text
https://dedarkness.github.io/MeuTreino/
```

## Dados locais e backup

Remover a PWA, apagar os dados do Safari ou uma limpeza de armazenamento do iOS pode eliminar o IndexedDB. Use **Ajustes → Exportar backup** periodicamente e guarde o JSON no app Arquivos ou iCloud Drive. A importação valida o formato antes de substituir os dados atuais.

## Estrutura

```text
src/screens/              Hoje, fichas, sessão ativa, histórico e ajustes
src/hooks/                estado React e fila de persistência
src/lib/database.ts       IndexedDB, validação, seed e backup
src/lib/workout.ts        regras de treino e sessão
src/types.ts              modelo de dados local
public/icons/             ícones PWA e apple-touch-icon
vite.config.ts            manifest e service worker offline
.github/workflows/        publicação no GitHub Pages
```

Tecnologias: React 19, TypeScript, Vite, vite-plugin-pwa, Workbox e IndexedDB nativo.
