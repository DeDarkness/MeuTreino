# MeuTreino

MeuTreino é uma PWA pessoal de academia feita para ser instalada na Tela de Início do iPhone. Não usa Expo, App Store, Apple Developer, conta, Supabase ou servidor. Treinos, cargas e histórico ficam no IndexedDB do próprio aparelho.

## Recursos

- Criar, editar, duplicar e excluir fichas.
- Rotina de segunda a sábado já cadastrada, com 39 exercícios e 130 séries.
- Seletor visual do dia de treino na tela inicial.
- Wallpaper personalizado com foto, GIF ou vídeo em loop salvo somente no aparelho.
- Wallpaper animado do Toji incluído como preset de aplicação imediata.
- Exercícios com séries, repetições, carga, descanso e observações.
- Execução série a série, reaproveitando a última carga e repetições registradas.
- Cronômetro de descanso com `+15 s`, pular, som e vibração.
- Descanso não bloqueante: navegue pelo app enquanto o contador continua em um painel flutuante.
- Edição de carga e repetições de qualquer série durante a sessão em andamento.
- Alerta sonoro reforçado, com teste nos Ajustes.
- Notificação de fim do descanso, com permissão solicitada diretamente pelo iPhone no app instalado.
- Sessão ativa restaurada após fechar ou recarregar o app.
- Painel de evolução com gráfico por exercício, carga, repetições, volume e força estimada.
- Detecção de recordes pessoais durante o treino e no histórico.
- Sugestão automática de carga pela progressão dupla, com botão para aplicar na série.
- Histórico detalhado preservado por exercício e série.
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

> A tela pode apagar normalmente durante o descanso. O alerta sonoro funciona com o app ativo e, após autorização, o MeuTreino também tenta mostrar uma notificação do iPhone. Como o cronômetro é totalmente local e não há servidor de Web Push, o iOS pode suspender o Web App e atrasar o aviso até o app voltar a executar.

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
