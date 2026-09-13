# Agenda diária de futebol

Projeto para Vercel e GitHub. Uma automação diária abre a agenda pública do Sofascore, coleta os jogos visíveis e grava `public/games.json`. A Vercel publica a versão atualizada depois de cada commit.

## Como subir

1. Crie um repositório vazio no GitHub.
2. Envie **o conteúdo desta pasta** para a raiz do repositório, incluindo a pasta oculta `.github`.
3. No GitHub, abra a aba **Actions**, escolha **Atualizar agenda de jogos** e clique em **Run workflow**.
4. No painel da Vercel, importe esse repositório. Não é preciso configurar variáveis de ambiente.

Depois da primeira execução, use:

- `https://SEU-PROJETO.vercel.app/games.json`
- `https://SEU-PROJETO.vercel.app/api/games`

## Dados e limites

O JSON contém data, horário mostrado, fuso, times, placar/status e link da origem. A página de agenda não divulga estádio, competição e canal de transmissão de todos os jogos; esses campos são gravados como `null`/vazio para não gerar dados falsos.

O processo não chama endpoint interno e não tenta contornar CAPTCHA ou bloqueios. Caso a página bloqueie a coleta, o job falha e mantém o JSON anterior. Antes de redistribuir dados comercialmente, confira os termos do site e obtenha autorização quando necessário.
