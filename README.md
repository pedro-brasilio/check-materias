# Check de Matérias

Aplicação web para acompanhar o progresso nas disciplinas do curso de Análise e Desenvolvimento de Sistemas (ADS) da UNIP.

## O que faz

- Registra as notas N1, N2 e PIM de cada matéria.
- Calcula a média semestral automaticamente: `MS = (N1 × 4 + N2 × 4 + PIM × 2) / 10`.
- Quando a média fica abaixo de 6,70, informa a nota mínima necessária no exame.
- Matérias com tag **DP** usam a fórmula `(N1 + N2) / 2`, sem o PIM.
- Arredonda a média de 6,70 a 6,99 para 7,0 (aprovação direta) e de 4,75 a 4,99 para 5,0 (após exame).
- Permite adicionar, editar e excluir matérias.
- Salva tudo no navegador (localStorage) — os dados ficam entre visitas.

## Tecnologias

- HTML
- CSS
- JavaScript (vanilla)

## Como usar

Abra o `index.html` no navegador ou acesse pela URL onde o projeto estiver hospedado. Preencha as notas e acompanhe a situação de cada matéria.
