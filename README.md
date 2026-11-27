# Teto

Simulador de financiamento imobiliário que compara **SAC** e **Price** lado a lado. As duas torres em 3D mostram quanto do imóvel já é seu: as janelas acendem conforme a dívida é paga.

**Teste no ar:** https://matheus0811.github.io/teto/

![Teto: duas torres em 3D, uma para o SAC e outra para a Price](og.png)

## O que ele faz

- Calcula as duas tabelas mês a mês a partir do valor do imóvel, da entrada, do prazo (até 35 anos) e da taxa de juros anual
- Converte a taxa anual em mensal equivalente: `i = (1 + taxa)^(1/12) − 1`
- Mostra primeira e última parcela, total de juros, total pago, prazo de quitação e a renda mínima pela regra dos 30%
- Diz quanto o SAC economiza de juros e quanto a primeira parcela dele é maior
- Simula seguros e taxas mensais e amortização extra todo mês (que encurta o prazo)
- **Linha do tempo**: escolha um mês (ou aperte "Ver o tempo passar") e veja as torres acenderem
  - azul-claro = entrada, âmbar = parte do financiamento já amortizada, escuro = o que falta pagar
- Gráficos de parcela e de saldo devedor, com valor de cada mês ao passar o mouse
- Tabela de amortização por ano ou mês a mês, com botão para copiar e colar no Excel
- Funciona no celular; se o 3D não carregar, aparece uma versão 2D e os cálculos continuam funcionando
- Respeita a opção "reduzir movimento" do sistema

## Tecnologias

- HTML, CSS e JavaScript (módulos ES), sem framework
- [Three.js](https://threejs.org) para a cena 3D (InstancedMesh para as janelas, uma cor por janela)
- Gráficos em SVG feitos à mão (sem biblioteca)
- Testes automatizados com o executor nativo do Node (`node --test`), sem dependências
- GitHub Actions rodando os testes a cada push

## Como rodar

Os cálculos não dependem de nada além do Node 20 ou mais novo:

```bash
npm test
```

Para abrir a página, sirva a pasta com qualquer servidor estático (módulos ES não abrem direto pelo `file://`):

```bash
npx serve .
# ou
python -m http.server 8000
```

## Estrutura

```
index.html                 página, estilos e layout
src/financiamento.js       cálculos puros: SAC, Price, validação, resumo anual
src/cena3d.js              cena Three.js com as duas torres
src/grafico.js             gráfico de linhas em SVG com dica ao passar o mouse
src/app.js                 liga formulário, cena, gráficos e tabela
tests/financiamento.test.js
ferramentas/video-demo.js  gera o vídeo de demonstração a partir da cena 3D real
```

## As contas

- **SAC**: amortização = valor financiado ÷ meses; parcela = amortização + saldo × i. A parcela cai todo mês.
- **Price**: parcela = PV × i ÷ (1 − (1 + i)^−n). A parcela é fixa; no começo, quase tudo é juros.

Os testes conferem os dois sistemas com valores conhecidos (ex.: R$ 100.000 a 1% ao mês em 12 meses dá parcela Price de R$ 8.884,88 e juros totais de R$ 6.500,00 no SAC).

## Limitações

É uma simulação educativa. Não entram TR, seguros obrigatórios (MIP e DFI) e tarifas, a não ser o valor informado em "Seguros e taxas". Para uma proposta real, peça ao banco o CET (Custo Efetivo Total).

---

Feito por [Matheus Galvão](https://www.linkedin.com/in/matheus-galvao) · [GitHub](https://github.com/Matheus0811)
