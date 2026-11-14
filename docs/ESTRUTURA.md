# Estrutura do projeto

```
sistema-rabbitech/
├── .github/workflows/     testes automáticos que rodam no GitHub a cada atualização
├── docs/                  guias (este arquivo, configuração, testes) e prints das telas
├── public/images/         logo, mapa do tapete e imagens das 15 missões
├── src/                   código do site
│   ├── pages/             uma tela por arquivo (Início, Calculadora, Estratégia, ...)
│   ├── components/        peças reutilizadas (cartões, player de música)
│   ├── lib/               lógica: banco (db), Supabase, pontuação, YouTube/Spotify
│   ├── data/              missões da temporada e dados iniciais
│   ├── App.jsx            menu lateral e rotas
│   └── styles.css         visual (branco, preto e azul)
├── supabase/
│   ├── schema.sql         banco completo (tabelas, segurança, dados iniciais)
│   └── functions/         buscas no YouTube e no Spotify (rodam no servidor)
├── tests/                 robô de testes (Playwright) e sua configuração
├── index.html  package.json  vite.config.js  vercel.json
│                          ficam na raiz porque o Vite e a Vercel procuram por eles ali
└── README.md
```

## Onde mexer para...

| Quero mudar... | Arquivo |
| --- | --- |
| Uma tela | `src/pages/<Tela>.jsx` |
| Itens do menu lateral | `src/App.jsx` |
| Cores e visual | `src/styles.css` |
| Regras de pontuação das missões | `src/data/missions.js` e `src/lib/scoring.js` |
| Posição das missões no mapa | `MISSION_POS` em `src/pages/Estrategia.jsx` |
| Sugestões/categorias da TV e da Music | `src/lib/media.js` |
| Tabelas do banco | `supabase/schema.sql` |
