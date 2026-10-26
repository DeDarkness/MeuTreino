# MeuTreino Elite 8.0.0 — Alimentação, treino e evolução

## Novas áreas

- Cinco áreas principais: Hoje, Treinos, Alimentação, Evolução e Ajustes.
- Wallpaper continua completo em Ajustes → Wallpaper, com fotos, vídeos e preset existentes.
- Hoje mostra consumo registrado, meta informada, proteína, água e média de peso dos últimos sete dias. Campos vazios não viram metas ou medições inventadas.
- Alimentação tem Diário, Minha Dieta, Alimentos, Corpo, Pré-operatório, Relatórios e Metas/perfil.

## Alimentação real, separada do plano

- Cadastro/edição/duplicação/remoção e reordenação de alimentos nas refeições. Quantidades em g ou ml conforme a referência; porções exigem tamanho cadastrado.
- Refeições padrão e personalizadas com horário opcional; busca sem acentos e favoritos.
- Planejamento por data, cópia para outro dia sem substituir o destino, modelos de refeições e lista de compras de sete dias. Compras preservam peso/preparo informado; não convertem cozido em cru por suposição.
- Marcar consumo de um item planejado é uma ação explícita e protegida contra duplicação. Planejar não soma ingestão. Consumo não pode ser criado no futuro.
- Históricos guardam uma fotografia dos nutrientes, fonte, confiança, unidade e quantidade do alimento utilizado. Editar o catálogo não reescreve o passado.
- Substituições matemáticas no mesmo grupo, por calorias, proteína, carboidratos ou gorduras. Cada alternativa mostra quantidade e diferenças de kcal/P/C/G/fibras; não é equivalência nutricional completa nem porção prescrita.

## Catálogo e fontes

- 345 referências em 12 grupos extraídas somente da seção de catálogo do TXT fornecido. Nenhum texto pessoal do documento foi incluído no código público.
- Todas são identificadas como **estimativas genéricas não verificadas**, não como TBCA/USDA verificadas. Todos os 345 registros têm fibras desconhecidas; campos permanecem nulos, sem zero inventado.
- Quantidades originais por 100 g ou 100 ml. Sem conversão automática entre massa e volume. Óleos em ml mantêm os valores do arquivo, já calculados pelo autor com densidade aproximada.
- Sem duplicatas no catálogo; relação 4P+4C+9G consistente dentro de 0,11 kcal de arredondamento. Isso não comprova exatidão nutricional.
- Cadastro manual por rótulo, ficha TBCA ou USDA, com fonte específica e data informadas pelo usuário. A origem é registrada, não auditada automaticamente pelo app.
- Importação local de TXT compatível, com pré-validação e atualização por identificadores estáveis, sem alterar refeições anteriores.
- Alimentos preparados genéricos permanecem aproximações. Um calculador de receitas por ingredientes/rendimento e fotos corporais não integram esta entrega.

## Metas e segurança

- Sem dieta automática, meta calórica padrão, déficit progressivo, prazo garantido de emagrecimento ou desconto de calorias do treino.
- Perfil começa vazio no código público. Configuração pessoal pode ser preenchida no aparelho ou importada por JSON privado; peso de referência e gordura estimada não criam pesagens confirmadas.
- Metas de kcal, P/C/G, fibras e água manuais. Conferência 4/4/9 não força calorias declaradas a coincidir com macros: fibras, fatores específicos e arredondamentos podem explicar diferenças. Valores originais são preservados.
- Validação profissional é uma declaração do usuário e exige anotação correspondente; não é certificação do app. Metas históricas são fotografadas por dia.
- Estimativa de repouso pela versão simplificada de Mifflin–St Jeor, com parâmetros editáveis; gasto total só se houver fator informado. Não são medições nem usados para prescrever ingestão.
- Aviso quando a meta fica abaixo do repouso estimado ou mais de 25% abaixo do gasto estimado. É um sinal de revisão escolhido para a interface, não corte clínico universal nem garantia de segurança acima dele.
- Fontes: [artigo original de Mifflin–St Jeor](https://pubmed.ncbi.nlm.nih.gov/2305711/), [documentação de energia do USDA](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/), [contexto do planejador NIDDK](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner).

## Evolução, recuperação e pré-operatório

- Uma ficha de medidas por dia: peso, cintura, quadril, braço, peitoral, coxa, panturrilha, gordura estimada, método e observações.
- Médias de 7/14/30 dias a partir de pesagens existentes, com contagem; gráficos com pontos inspecionáveis, sem dados ilustrativos apresentados como pessoais.
- Massa livre de gordura só é estimada a partir de peso e percentual registrados juntos; nunca chamada de massa muscular medida.
- Água, sono, fome, energia, fadiga, recuperação e notas diárias; marcação explícita de diário completo.
- Data de cirurgia, contagem de dias, orientações, liberação declarada pelo usuário, período e tolerância de estabilidade indicados pela equipe e checklist editável.
- Estabilidade descreve amplitude e cobertura dos registros, não aptidão cirúrgica. Nenhuma exigência universal de dias ou tolerância é inventada.
- Relatórios de 7/14/30 dias com dados alimentares/corporais, sono e séries de treino realmente registradas. Médias alimentares usam dias marcados como completos; ausência de registro não vira consumo zero.
- Exportação CSV com tratamento contra fórmulas em texto e impressão/salvar PDF usando o recurso do aparelho. PDF não é gerado por um serviço na nuvem.

## Persistência e atualização

- Novo módulo opcional `nutrition.version=1` dentro do estado atual. Mantidos schema 1 e IndexedDB 2; não há substituição de lojas ou banco.
- Migração do estado sem nutrição adiciona apenas estrutura vazia e guarda cópia anterior na mesma transação. Treino ativo, histórico, fichas e fila de reposição preservados.
- Backup completo inclui nutrição, perfil, medidas e treinos. Wallpaper e inscrição Push continuam fora do JSON. O backup contém dados pessoais; guarde com cuidado.
- Backup antigo somente de treinos preserva a alimentação atual ao restaurar. Backup novo completo restaura também a alimentação contida nele, com confirmação e cópia anterior.
- Operações nutricionais aguardam gravação e validam o estado inteiro antes de publicar a mudança na interface; falha mantém o estado anterior.
- Funções essenciais locais e catálogo incluído funcionam pelo cache PWA. Não há login, servidor nutricional ou sincronização entre dispositivos.
- A/B/C continua 22/23/21 = 66 séries. Nenhuma alteração na prescrição ou no TXT fixo da Área de Trabalho.

## Atualizar no iPhone

Exporte um backup em Ajustes antes da atualização. Com o app sem sessão ativa, abra com internet, aceite Atualizar e confira **8.0.0** nos Ajustes. Não reinstale nem limpe os dados. Depois, acesse Alimentação → Metas e perfil para configurar seus próprios dados; a tabela inicial está em Alimentos.
