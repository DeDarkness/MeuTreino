# MeuTreino

MeuTreino é uma PWA pessoal de academia feita para ser instalada na Tela de Início do iPhone. Não usa Expo, App Store, Apple Developer, login ou Supabase. Treinos, cargas e histórico ficam no IndexedDB do próprio aparelho. O serviço opcional na Cloudflare envia somente avisos de descanso em segundo plano.

## Recursos

- Criar, editar, duplicar e excluir fichas.
- Full Body avançado 3× por semana já cadastrado: A na segunda, B na quarta e C na sexta, com 27 exercícios e 69 séries.
- Metas de RIR, intervalos de repetição e descansos específicos em cada exercício.
- Seletor visual do dia de treino na tela inicial.
- Wallpaper personalizado com foto, GIF ou vídeo em loop salvo somente no aparelho.
- Wallpaper animado do Toji incluído como preset de aplicação imediata.
- Exercícios com séries, repetições, carga, descanso e observações.
- Execução série a série, reaproveitando a última carga e repetições registradas.
- Cronômetro de descanso com `+15 s`, pular, som e vibração.
- Descanso não bloqueante: navegue pelo app enquanto o contador continua em um painel flutuante.
- Edição de carga e repetições de qualquer série durante a sessão em andamento.
- Alerta sonoro reforçado, com teste nos Ajustes.
- Web Push de fim do descanso, agendado pelo serviço Cloudflare e recebido com a tela bloqueada; ligado por padrão após autorização no iPhone.
- Confirmação de agendamento, reagendamento com `+15 s`, cancelamento e teste independente de 10 segundos.
- Sessão ativa restaurada após fechar ou recarregar o app.
- Painel de evolução com gráfico por exercício, carga, repetições, volume e força estimada.
- Detecção de recordes pessoais durante o treino e no histórico.
- Sugestão automática de carga pela progressão dupla, com botão para aplicar na série.
- Histórico detalhado preservado por exercício e série.
- Registro de RIR por série e reaproveitamento no resumo do treino.
- Superséries configuráveis, alternadas automaticamente sem descanso no meio da rodada.
- Exercícios reordenáveis durante a sessão, com opções de fazer depois, pular e reativar.
- Aquecimento automático calculado pela carga de trabalho.
- Calculadora de anilhas por lado da barra.
- Anotações rápidas da sessão salvas no histórico.
- Calendário de frequência mensal e sequência semanal.
- Resumo pós-treino com comparação de volume, recordes, comemoração e compartilhamento.
- Opção de desfazer uma série concluída.
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

> A tela pode apagar normalmente durante o descanso. Use Testar notificações nos Ajustes do MeuTreino para autorizar o iPhone e confira a mensagem de agendamento antes de bloquear a tela. Depois da autorização, os avisos ficam ligados automaticamente. O Web Push exige internet e pode sofrer atrasos; o som segue as configurações do iPhone. Treinar, registrar séries e consultar histórico continua funcionando offline.

## Serviço gratuito de notificações

O código está em `push-service/`. Ele usa Workers Free e Durable Objects com SQLite. Um aparelho tem somente um descanso e um teste pendentes, com credencial própria e revisões para rejeitar pedidos antigos. Avisos expiram após 60 segundos e inscrições encerradas são desativadas. Nenhum treino, carga ou histórico completo é enviado.

Depois de criar sua conta Cloudflare, execute na pasta `push-service`:

```bash
npm ci
npm run typecheck
npm test
npm run setup-keys
npm run login
npm run deploy
npm run upload-keys
```

O login abre a autorização oficial no navegador. As chaves são geradas uma vez em `.secrets/vapid.json`, ignorado pelo Git, e enviadas como segredos para a Cloudflare. Não publique nem substitua essas chaves em atualizações normais.

Após publicar, configure o endereço público `workers.dev` em `src/lib/pushConfig.ts` ou na variável de build `VITE_PUSH_SERVICE_URL`, recompile o PWA e publique pelo GitHub Pages. O endereço é público; a chave privada nunca deve entrar no frontend. O serviço não exige domínio próprio ou plano pago e permanece sujeito aos limites do plano Free.

No iPhone: abra pelo ícone da Tela de Início → Ajustes → Testar notificações → aceite a permissão, se solicitada → bloqueie a tela. O serviço agenda o teste para 10 segundos depois, sem substituir o descanso em andamento. Após autorização, os avisos ficam ativos automaticamente; inscrições existentes são reconectadas ao abrir o app, sem cancelar alarmes pendentes. Para bloquear os avisos, use Ajustes → Notificações → MeuTreino no próprio iPhone. As inscrições são específicas do aparelho e não entram no backup JSON do treino.

O resultado do teste aparece automaticamente ao voltar ao app, com detalhes de autorização do iPhone, inscrição local, recebimento e conexão com o serviço. “Teste enviado ao sistema do iPhone” indica aceitação pelo provedor de push, não confirmação de exibição ou som no aparelho. Os resultados são acessíveis somente com a credencial daquele dispositivo, sem expor chaves ou endpoints. No transporte, o Worker usa `redirect: 'manual'`, compatível com a Cloudflare e sem encaminhar credenciais em redirecionamentos.

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
