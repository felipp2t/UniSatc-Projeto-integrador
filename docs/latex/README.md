# Documento acadêmico do Vaulty

Arquivo principal: [vaulty.tex](./vaulty.tex). Pesquisa, decisões e fontes: [ABNT.md](../ABNT.md).

É uma base de trabalho acadêmico completo, com introdução e síntese da concepção já redigidas. Os campos entre colchetes e comentários `TODO` identificam o que ainda precisa ser preenchido. A especificação detalhada continua em [REQUISITOS.md](../REQUISITOS.md); ainda não foi integralmente transposta para LaTeX.

## Compilação

Usar **LuaLaTeX**, com abnTeX2, fontspec, geometry e graphicx disponíveis na distribuição TeX. Não usar pdfLaTeX: a seleção de fontes deste arquivo depende de fontspec. A fonte é Times New Roman se disponível ao compilador; caso contrário, TeX Gyre Termes. O fallback gera aviso no log e não deve ser descrito como Times New Roman exata.

Com latexmk disponível, a partir da raiz do repositório:

```bash
cd docs/latex
latexmk -lualatex -interaction=nonstopmode -halt-on-error -outdir=build vaulty.tex
```

Sem latexmk, executar LuaLaTeX duas vezes para atualizar sumário e referências cruzadas:

```bash
cd docs/latex
mkdir -p build
lualatex -interaction=nonstopmode -halt-on-error -output-directory=build vaulty.tex
lualatex -interaction=nonstopmode -halt-on-error -output-directory=build vaulty.tex
```

Resultado esperado: `build/vaulty.pdf`. Num editor online com distribuição TeX, selecionar LuaLaTeX e `vaulty.tex` como arquivo principal; nenhum envio externo foi feito nesta tarefa.

Este ambiente não possui compilador TeX. A revisão estática não substitui compilação nem inspeção visual; ainda não há PDF validado. Não foram instalados pacotes nesta tarefa.

## Edição

Os dados de capa/rosto ficam no preâmbulo. A ficha catalográfica está desativada até a biblioteca fornecer o documento; ao habilitá-la, preencher o bloco indicado. A folha de aprovação contém campos pendentes, sem registrar aprovação ocorrida. Listas opcionais de figuras/tabelas estão comentadas até haver elementos reais.

Para acrescentar uma figura:

```latex
Como apresentado na Figura~\ref{fig:arquitetura}, ...
\begin{figure}[htbp]
  \centering
  \begin{minipage}{0.9\textwidth}
    \caption{Arquitetura do sistema}
    \label{fig:arquitetura}
    \includegraphics[width=\linewidth]{figuras/arquitetura.pdf}
    \fonte{elaboração própria (2026).}
  \end{minipage}
\end{figure}
```

Criar o diretório `figuras` quando existir a primeira imagem. A minipage mantém título e fonte na largura da figura. Para quadros de requisitos, usar um contador/lista próprios ao introduzi-los; não denominar toda matriz textual como tabela estatística. Não inserir imagens de exemplo como se fossem artefatos do produto.

As referências iniciais são manuais e pertencem à normalização; adicionar bibliografia de domínio conforme for citada. Conferir a NBR 6023:2025 antes de adotar um gerador bibliográfico. Não habilitar estilos antigos supondo conformidade automática.
