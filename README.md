# MeuTreino — app de treino para iPhone

O **MeuTreino é, primeiro, um aplicativo iOS nativo** feito com Expo, React Native e TypeScript. No iPhone você monta e executa o treino, registra séries, repetições e carga, acompanha o descanso e recebe aviso sonoro/háptico quando o tempo termina.

A versão web é somente um **editor complementar**: ela facilita cadastrar ou alterar fichas usando o teclado do PC ou notebook. Entrando com a mesma conta, as alterações aparecem no iPhone.

## O que já está pronto

- Criação, edição e exclusão de fichas de treino.
- Exercícios com nome, séries, repetições e descanso individual.
- Sessão ativa série a série, com registro de carga e repetições realizadas.
- Cronômetro de descanso com som, vibração e notificação local no iOS.
- Histórico com duração, volume de séries e repetições.
- Preferências de descanso, som, vibração e unidade de peso (`kg` ou `lb`).
- Funcionamento local mesmo sem internet.
- Conta por e-mail e senha e sincronização opcional com Supabase.
- Conciliação automática de alterações realizadas offline.
- Layout adaptável ao iPhone e ao editor web.
- Ícone e tela de abertura próprios do MeuTreino.

## Arquitetura do produto

```text
iPhone (app principal) ─┐
                       ├─ Supabase ─ mesma conta e mesmos treinos
PC/notebook (editor) ──┘
```

O app não depende da web para funcionar durante o treino. O Supabase só é necessário para transportar os dados entre o computador e o iPhone.

## Rodar o projeto localmente

Pré-requisitos: Node.js LTS e npm.

```bash
npm install
npm start
```

Para abrir somente o editor no computador:

```bash
npm run web
```

O endereço local normalmente será `http://localhost:8081`.

> O projeto usa Expo SDK 57. Para testar todas as funções nativas no iPhone, use um build de preview/TestFlight; a versão pública do Expo Go instalada pela App Store pode estar em outro SDK.

## Instalar um build de teste no iPhone

O build é compilado nos servidores EAS, por isso ele pode ser solicitado a partir do Windows. Você precisa de uma conta Expo e, para assinar e instalar no iPhone, de uma conta Apple Developer.

Na primeira vez:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npm run build:ios:preview
```

O EAS orientará o cadastro do aparelho e das credenciais Apple. Ao terminar, ele fornecerá o link de instalação do build interno.

## Gerar a versão para TestFlight/App Store

```bash
npm run build:ios
npm run submit:ios
```

O perfil `production` incrementa automaticamente o número do build. Depois do envio e processamento pela Apple, a versão poderá ser liberada no TestFlight e, mais tarde, submetida à revisão da App Store.

Antes da primeira publicação:

- confirme se `com.joao.meutreino` está livre na sua conta Apple; se necessário, troque o `bundleIdentifier` em `app.json`;
- cadastre no App Store Connect o nome, descrição, categoria, classificação etária, screenshots e URL pública da política de privacidade;
- confirme as respostas de privacidade com base nos dados realmente coletados;
- teste login, sincronização, restauração offline, cronômetro, som e notificações em um iPhone físico.

## Configurar a sincronização entre PC e iPhone

### 1. Preparar o Supabase

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Abra **SQL Editor** no painel.
3. Execute todo o conteúdo de `supabase/migrations/001_initial.sql`.
4. Em **Authentication > Providers**, mantenha o provedor de e-mail habilitado.
5. Implante a função segura de exclusão de conta:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref SEU_PROJECT_REF
npx supabase@latest functions deploy delete-account
```

A validação de JWT dessa função deve permanecer ativada; não use `--no-verify-jwt`. A chave administrativa existe somente no ambiente seguro da função e nunca deve ser copiada para o app. A migração cria um documento por usuário, ativa Row Level Security, impede que uma conta leia os treinos de outra e remove os dados sincronizados em cascata quando a conta é excluída.

### 2. Configurar o ambiente local

No PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Preencha o arquivo `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_sua_chave
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://seu-dominio.com/privacidade.html
EXPO_PUBLIC_SUPPORT_EMAIL=suporte@seu-dominio.com
```

Use apenas a chave pública/publishable. Nunca use `service_role` em uma variável `EXPO_PUBLIC_*`.

Depois reinicie o servidor:

```bash
npx expo start --clear
```

### 3. Configurar os builds EAS

Cadastre as quatro variáveis como variáveis de ambiente dos ambientes **preview** e **production** no projeto Expo/EAS. O arquivo `.env.local` não é enviado ao build e não deve conter segredos versionados.

### 4. Usar

1. No editor web, abra **Conta**, crie uma conta ou entre.
2. No iPhone, entre com o mesmo e-mail e senha.
3. Edite a ficha no PC ou no app.
4. Os dados são salvos localmente e sincronizados quando houver conexão.

## Privacidade e exclusão de conta

A política está disponível dentro da tela **Conta**. Antes de publicar, revise o modelo em `docs/PRIVACIDADE.md`, preencha o responsável e o contato, publique-o em uma URL HTTPS e use essa URL em `EXPO_PUBLIC_PRIVACY_POLICY_URL` e no campo **Privacy Policy URL** do App Store Connect.

Na mesma tela, uma pessoa conectada pode tocar em **Excluir minha conta**. Após confirmação, o app chama a Edge Function autenticada, exclui a conta inteira do Supabase, remove os dados sincronizados e locais e encerra a sessão.

Também configure uma **Support URL** pública no App Store Connect. As respostas de App Privacy devem refletir o uso real: e-mail, identificador da conta e dados de fitness/treino são usados para funcionalidade e sincronização, vinculados à conta e sem rastreamento.

## Alertas de descanso no iPhone

O fim do descanso usa notificação local, som e feedback háptico. O iOS pedirá permissão e pode silenciar o alerta se o aparelho estiver em modo Silencioso, Foco/Não Perturbe ou se as notificações do MeuTreino estiverem desativadas nos Ajustes.

## Validação técnica

```bash
npm run typecheck
npm run lint
npm run doctor
npx expo export --platform ios --output-dir .expo/ios-export
```

Para validar o editor web:

```bash
npm run export:web
```

## Estrutura principal

```text
src/app/                         rotas e entrada do app
src/screens/                     fichas, histórico e conta
src/components/                  interface iPhone-first e responsiva
src/context/                     estado e operações do produto
src/lib/                         persistência, autenticação, merge e sync
src/services/rest-alert.ts       alerta nativo de descanso no iOS
src/services/rest-alert.web.ts   fallback do editor no navegador
supabase/migrations/             banco, políticas e funções seguras
supabase/functions/              exclusão autenticada da conta
assets/images/                   ícone e splash do MeuTreino
docs/                            modelo público de privacidade
app.json                         identidade e configuração iOS
eas.json                         builds internos e de produção
```

Tecnologias: Expo SDK 57, React Native, Expo Router, Expo SQLite, Expo Notifications e Supabase.
