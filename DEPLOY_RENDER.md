# 🚀 Tutorial: Deploy no Render com GitHub

## ✅ Pré-requisitos Concluídos
- ✅ Repositório GitHub: `https://github.com/1brunodosanjos/msafiscalizacao`
- ✅ Pacote `serve` instalado
- ✅ Script `start` configurado no package.json
- ✅ Arquivo `render.yaml` criado

---

## 📝 Passo a Passo para Deploy

### 1️⃣ Criar Conta no Render

1. Acesse: [https://render.com](https://render.com)
2. Clique em **"Get Started for Free"**
3. **Recomendado:** Faça login com sua conta do GitHub (mais fácil para conectar repositórios)
   - Clique em **"Sign up with GitHub"**
   - Autorize o Render a acessar sua conta

---

### 2️⃣ Conectar o Repositório GitHub

#### Opção A: Usando o arquivo render.yaml (Recomendado - Mais Fácil)

1. No dashboard do Render, clique em **"New +"** → **"Blueprint"**
2. Conecte sua conta do GitHub se ainda não estiver conectada
3. Selecione o repositório **"msafiscalizacao"**
4. O Render vai detectar automaticamente o arquivo `render.yaml`
5. Clique em **"Apply"**

#### Opção B: Configuração Manual

1. No dashboard do Render, clique em **"New +"** → **"Web Service"**
2. Clique em **"Connect a repository"**
3. Se não aparecer seu repositório:
   - Clique em **"Configure account"**
   - Selecione sua conta do GitHub
   - Dê permissão para o repositório **"msafiscalizacao"**
4. Clique em **"Connect"** ao lado do repositório

---

### 3️⃣ Configurar o Web Service (Se usar Opção B)

Preencha os campos:

#### **Informações Básicas:**
- **Name:** `msa-fiscalizacao` (ou outro nome de sua preferência)
- **Region:** Escolha a região mais próxima:
  - `Oregon (US West)` - Oeste dos EUA
  - `Ohio (US East)` - Leste dos EUA
  - `Frankfurt (EU Central)` - Europa
  - `Singapore (Asia)` - Ásia
- **Branch:** `main`
- **Root Directory:** (deixe em branco)

#### **Build & Deploy:**
- **Runtime:** `Node`
- **Build Command:** 
  ```bash
  npm install && npm run build
  ```
- **Start Command:**
  ```bash
  npm start
  ```

#### **Plano:**
- Selecione **"Free"** para começar
  - 750 horas/mês grátis
  - Aplicação pode "dormir" após 15 minutos de inatividade
  - Primeira requisição pode demorar ~30 segundos

---

### 4️⃣ Configurar Variáveis de Ambiente

**MUITO IMPORTANTE:** Sua aplicação precisa das credenciais do Supabase.

1. Role para baixo até **"Environment Variables"**
2. Clique em **"Add Environment Variable"**
3. Adicione as seguintes variáveis:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Sua URL do Supabase (ex: `https://xxxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Sua chave anônima do Supabase |

#### 📍 Onde encontrar essas informações?

**Opção 1 - Arquivo .env local:**
```bash
# Abra o arquivo .env no seu projeto
# Copie os valores de:
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**Opção 2 - Dashboard do Supabase:**
1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`

---

### 5️⃣ Iniciar o Deploy

1. Clique em **"Create Web Service"** (ou **"Apply"** se usou Blueprint)
2. O Render vai começar o build automaticamente
3. Você verá os logs em tempo real:
   ```
   ==> Installing dependencies...
   ==> Building application...
   ==> Starting service...
   ==> Your service is live 🎉
   ```
4. Aguarde alguns minutos (geralmente 3-5 minutos)

---

### 6️⃣ Acessar sua Aplicação

Quando o deploy terminar:

1. Você verá uma URL no topo da página, algo como:
   ```
   https://msa-fiscalizacao.onrender.com
   ```
2. Clique na URL ou copie e cole no navegador
3. Sua aplicação estará rodando! 🎉

---

## 🔄 Deploys Automáticos

**Boa notícia:** Agora toda vez que você fizer push para o GitHub, o Render vai fazer deploy automaticamente!

```bash
# Faça suas alterações no código
git add .
git commit -m "Descrição das alterações"
git push

# O Render detecta o push e faz deploy automaticamente! 🚀
```

---

## 🛠️ Configurações Adicionais (Opcional)

### Domínio Personalizado

1. No dashboard do Render, vá em **Settings** → **Custom Domain**
2. Adicione seu domínio
3. Configure os DNS conforme instruções

### Notificações

1. Vá em **Settings** → **Notifications**
2. Configure notificações por email ou Slack para:
   - Deploy bem-sucedido
   - Falhas no deploy
   - Alertas de saúde do serviço

### Auto-Deploy

1. Vá em **Settings** → **Build & Deploy**
2. **Auto-Deploy:** `Yes` (já vem ativado por padrão)
   - Faz deploy automático a cada push na branch `main`

---

## 🐛 Troubleshooting

### ❌ Build falhou

**Verifique os logs:**
- Clique em **"Logs"** no menu lateral
- Procure por erros em vermelho
- Erros comuns:
  - Dependências faltando → Verifique `package.json`
  - Variáveis de ambiente faltando → Adicione no painel
  - Erros de TypeScript → Corrija no código

### ❌ Aplicação não carrega

1. **Verifique as variáveis de ambiente:**
   - `VITE_SUPABASE_URL` está correta?
   - `VITE_SUPABASE_ANON_KEY` está correta?

2. **Verifique os logs de runtime:**
   - Vá em **Logs** → **Runtime Logs**
   - Procure por erros de conexão com Supabase

### ❌ Aplicação "dorme" (plano Free)

No plano Free, a aplicação dorme após 15 minutos de inatividade.

**Soluções:**
- **Upgrade para plano pago** ($7/mês) - aplicação sempre ativa
- **Use um serviço de ping** (ex: UptimeRobot) para manter ativa
- **Aceite o delay** - primeira requisição demora ~30s

---

## 📊 Monitoramento

### Ver Logs em Tempo Real

1. No dashboard, clique em **"Logs"**
2. Você verá:
   - **Build Logs:** Logs do processo de build
   - **Runtime Logs:** Logs da aplicação rodando
   - **Events:** Histórico de deploys e eventos

### Métricas

1. Clique em **"Metrics"**
2. Veja:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

---

## 🎯 Checklist Final

Antes de considerar o deploy completo, verifique:

- [ ] Aplicação abre sem erros
- [ ] Login funciona (conexão com Supabase OK)
- [ ] Todas as páginas carregam corretamente
- [ ] Dados aparecem (fiscalizações, gestores, etc.)
- [ ] Formulários funcionam (criar/editar registros)
- [ ] Permissões estão corretas

---

## 📚 Recursos Úteis

- **Dashboard do Render:** [https://dashboard.render.com](https://dashboard.render.com)
- **Documentação do Render:** [https://render.com/docs](https://render.com/docs)
- **Status do Render:** [https://status.render.com](https://status.render.com)
- **Suporte:** [https://render.com/support](https://render.com/support)

---

## 💡 Dicas Importantes

1. **Sempre teste localmente antes de fazer push:**
   ```bash
   npm run build
   npm start
   # Acesse http://localhost:3000
   ```

2. **Use branches para testar:**
   ```bash
   git checkout -b feature/nova-funcionalidade
   # Faça suas alterações
   git push origin feature/nova-funcionalidade
   # Crie um Pull Request no GitHub
   # Merge para main quando estiver pronto
   ```

3. **Monitore os logs após cada deploy:**
   - Verifique se há erros
   - Teste as funcionalidades principais

4. **Mantenha as variáveis de ambiente seguras:**
   - Nunca faça commit do arquivo `.env`
   - Use variáveis de ambiente do Render

---

## 🎉 Pronto!

Seu projeto agora está configurado para deploy contínuo no Render!

Qualquer dúvida, consulte a documentação ou entre em contato com o suporte do Render.

**Boa sorte com seu projeto! 🚀**
