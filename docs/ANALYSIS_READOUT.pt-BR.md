# Leitura analítica do SignalPath

Snapshot: 02/01/2021 a 31/01/2021, comparado com 03/12/2020 a 01/01/2021. Os valores foram recalculados a partir dos marts exportados do BigQuery em 14/09/2026.

## Resposta executiva

O alcance caiu, mas a intenção de compra caiu muito mais. Os usuários passaram de 99.543 para 92.825 (-6,8%), as sessões de 125.893 para 116.075 (-7,8%) e os compradores de 1.828 para 1.057 (-42,2%). A taxa de compradores no escopo atual é de 1,14% (1.057 / 92.825), contra 1,84% no período anterior. Essa é uma mudança descritiva na amostra pública, não um diagnóstico causal.

## O que investigar primeiro

Referral é o sinal de aquisição mais forte observado no período atual: 498 compradores e conversão de usuários de 1,35%. Direct vem em seguida, com 250 compradores e 0,99%; organic traz o maior alcance, com 37.712 usuários, mas converte 0,82%; paid tem 5.119 usuários e conversão de 0,70%. As contagens de usuários por canal são associações e não atribuição exclusiva, portanto não devem ser somadas como pessoas únicas.

A maior categoria atual por receita de itens é Apparel, com US$ 29.458, aproximadamente 65% da receita do mart de produtos no período. Accessories, Bags e New vêm depois, com US$ 3.713, US$ 3.119 e US$ 2.829. Isso apoia priorizar as jornadas de Apparel e verificar se a categoria está associada à demanda e à conversão, sem assumir que ela causa o resultado.

As maiores taxas de conversão observadas entre países com pelo menos 100 usuários foram Finlândia (2,84%, 141 usuários), Áustria (2,42%, 248), Grécia (2,05%, 341), Chile (1,96%, 153) e Colômbia (1,94%, 464). São amostras pequenas e devem ser tratadas como candidatos à investigação, não como ranking de qualidade de mercado.

O maior número diário de compradores foi 94 em 20/01/2021, enquanto o maior número diário de usuários foi 5.486 em 06/01/2021. Volume e intenção não atingem o pico no mesmo dia, o que reforça a separação entre qualidade do tráfego e alcance no dashboard.

## Sequência recomendada de ação

1. Inspecionar as páginas de entrada e o comportamento de compra de referral, usando a mesma janela de datas e um limite mínimo de amostra.
2. Comparar as jornadas de organic e referral por dispositivo e país antes de alterar investimentos.
3. Investigar a jornada de Apparel e a instrumentação nos dias com maior número de compradores.
4. Tratar paid como diagnóstico de qualidade até entender sua conversão; não inferir ROI porque a amostra pública não fornece investimento.

## Limitações

A fonte é uma amostra pública e ofuscada de comércio eletrônico. Downloads, eventos e compras não são declarações de receita de uma empresa real. O mart de sessões não certifica pedidos únicos entre todos os produtos, e a fonte em nível de evento não está armazenada localmente. Por isso, a página de funil apresenta alcance independente de eventos e comportamento de compradores filtrados, não abandono sequencial. As conclusões são observacionais e não estabelecem causalidade.
