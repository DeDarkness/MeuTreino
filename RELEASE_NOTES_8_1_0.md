# MeuTreino 8.1.0 — alimentação simples, visual premium

## Pesquisa e decisões

Referências oficiais consultadas em 26/10/2026, sem pretensão de ranking universal:

- [MacroFactor — registro de alimentos](https://help.macrofactorapp.com/en/articles/215-how-to-log-food-in-macrofactor): atalhos e registro em conjunto inspiraram o foco em ações de poucos toques.
- [YAZIO — diário e painel](https://help.yazio.com/hc/en-us/articles/11804776635281-Tutorial-of-the-Yazio-app): resumo de consumo e macros separado dos detalhes de edição.
- [Cronometer — adicionar alimento](https://support.cronometer.com/hc/en-us/articles/360018193011-Add-a-Food): porção e fonte consultáveis dentro da edição.

São inspirações de fluxo, não cópia de telas, marcas, imagens ou código. Não foram incorporados recursos pagos, IA, leitor de códigos ou cálculo de gasto/jejum dessas plataformas.

## Uso principal

- Meu dia apresenta semana navegável, resumo circular de calorias e macros, cards compactos de refeições, água e fechamento explícito do diário.
- Comi esta refeição registra todos os itens restantes, inclusive preparo, sem duplicação. Desfazer afeta somente o consumo ligado ao plano; registros avulsos são preservados.
- Abrir um card mostra os alimentos. Checkbox marca/desmarca um item; tocar no alimento abre edição de quantidade/substituição numa folha inferior, sem formulário longo na página.
- Campo de quantidade pode ser apagado. Zero, vazio, NaN e valores inválidos não são salvos; porções e total do dia são recalculados antes de confirmar.
- Trocar abre opções completas da refeição com pesos, kcal/proteína e projeção diária. Altera apenas o planejamento do dia escolhido, sem reescrever consumo. Opções que excedam 1.700 kcal no plano atual ficam indisponíveis.
- Fonte/confiança/preparo e fibras desconhecidas continuam disponíveis na edição. Planejamento nunca é apresentado como ingestão realizada.
- Só macros com meta definida mostram progresso. Ausência de meta não vira 100% atingido; dados e progresso não são inventados.
- Sem plano: ativação explícita do cardápio existente para o dia, sem criar consumo ou meta nova. Montagem da semana continua disponível em Cardápio e opções da semana.

## Organização e visual

- Três acessos principais: Meu dia, Minha Dieta e Mais. Alimentos/favoritos, corpo, relatórios, metas, pré-operatório e ferramentas de sono/registro detalhado continuam acessíveis.
- Paleta escura/neutra com verde, espaços consistentes, hierarquia tipográfica, cards por refeição, estado de consumo e botões com feedback discreto.
- Folhas de edição com foco preso, Escape/fechar e retorno ao controle anterior; área segura do iPhone e alvos de toque grandes. Animações respeitam preferência por movimento reduzido.
- Edição fica acima da navegação inferior, com confirmação fixa no rodapé da folha. Registros de planos anteriores ficam separados e preservados; há confirmação antes de registrar uma refeição que já tenha consumo fora do plano atual.
- Sem dependências novas, fontes externas, fotos remotas ou rede para o diário. Wallpaper, descanso, avisos e treinos preservados.
- A dieta e as 504 combinações anteriores não foram modificadas. Não há prescrição profissional validada ou mudança automática de meta.
- Banco, schema, backups, medidas e prescrição de treinos permanecem os mesmos. Operações passam pelo armazenamento durável/checkpoint existente.

Atualizar após backup, online e sem treino ativo; conferir versão 8.1.0. Não reinstalar nem limpar dados.
