# MeuTreino Elite 6.3.0 — versão revisada em 19/10/2026

- Full Body A/B/C: 20, 19 e 21 séries; Express: 15 por sessão.
- Seleção Completo/Express, painel de volume semanal por músculo dominante, faixas de repetições e RIR editáveis, sessões Express identificadas no histórico.
- Atualização automática e única das fichas A/B/C ao abrir a nova versão. Fichas anteriores diferentes são arquivadas; histórico e demais fichas são preservados. Se houver sessão ativa, a troca aguarda sua conclusão. Reaplicação disponível em Ajustes > Protocolos.
- Express valida ordem e identidade dos exercícios para evitar cortes errados em fichas reordenadas.
- Progressão usa a meta numérica atual, mesmo se houver observações antigas.

## Validação final
npm ci com package-lock original; TypeScript, ESLint, 47 testes e build PWA aprovados.
Testes incluem volumes, Express, preservação de fichas/histórico, backup JSON com sessão Express e progressão após edição das metas.
Não testado em iPhone físico. Publicação executada pelo workflow GitHub Pages ao enviar para main.

## Usar no iPhone
1. Exportar backup JSON no aplicativo atual.
2. Publicar a versão no mesmo endereço/origem do PWA.
3. Abrir a versão atualizada; finalizar uma sessão em andamento, se houver.
4. O protocolo será aplicado automaticamente uma única vez, após terminar eventual sessão ativa. Reaplicação disponível em Ajustes > Protocolos de treino.
5. Conferir fichas/histórico e escolher Completo ou Express ao iniciar.
