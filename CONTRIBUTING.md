# Contribuindo para o Serv Motors

Obrigado por seu interesse em contribuir com o Serv Motors! Este documento fornece diretrizes para contribuições ao projeto.

## 🚀 Como Contribuir

### 1. Fork e Clone
```bash
# Fork o repositório no GitHub
# Clone seu fork
git clone https://github.com/seu-usuario/servmotors_rp_blt.git
cd servmotors_rp_blt
```

### 2. Configuração do Ambiente
```bash
# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Execute as migrações
npm run db:push

# Inicie o ambiente de desenvolvimento
npm run dev
```

### 3. Criando uma Branch
```bash
# Crie uma branch descritiva
git checkout -b feature/nova-funcionalidade
# ou
git checkout -b bugfix/correcao-importante
```

## 📝 Padrões de Código

### TypeScript
- Use TypeScript em todos os arquivos
- Defina tipos explícitos quando necessário
- Utilize os tipos compartilhados em `shared/schema.ts`

### React
- Use functional components com hooks
- Mantenha componentes pequenos e focados
- Utilize Custom Hooks para lógica reutilizável
- Prefira composição over inheritance

### Styling
- Use TailwindCSS para estilização
- Componentes shadcn/ui para interface
- Mantenha consistência visual

### Backend
- Valide entrada com Zod
- Use Drizzle ORM para banco de dados
- Mantenha rotas organizadas em `server/routes.ts`
- Implemente tratamento de erros adequado

## 🗂️ Estrutura de Commits

Use commits semânticos:
```
feat: adiciona nova funcionalidade
fix: corrige bug específico
docs: atualiza documentação
style: formatação de código
refactor: refatoração sem mudança de funcionalidade
test: adiciona ou modifica testes
chore: tarefas de manutenção
```

Exemplos:
```
feat: implementa sistema de avaliações
fix: corrige cálculo de preço dinâmico
docs: atualiza guia de instalação
refactor: reorganiza componentes de pagamento
```

## 🧪 Testes

### Executando Testes
```bash
# Execute os testes
npm test

# Testes com coverage
npm run test:coverage
```

### Escrevendo Testes
- Teste componentes críticos
- Cubra casos de erro
- Use dados realistas nos testes
- Mantenha testes independentes

## 📋 Checklist para Pull Requests

Antes de submeter seu PR, verifique:

- [ ] Código segue os padrões estabelecidos
- [ ] Funcionalidade foi testada localmente
- [ ] Commits seguem padrão semântico
- [ ] Documentação foi atualizada se necessário
- [ ] Não há quebras em funcionalidades existentes
- [ ] Variáveis sensíveis não estão no código
- [ ] Build está funcionando (`npm run build`)

## 🔍 Processo de Review

1. Submeta o Pull Request
2. Aguarde review da equipe
3. Implemente mudanças solicitadas
4. PR será aprovado e merged

## 🐛 Reportando Bugs

Use o template de issue:
```
**Descrição do Bug**
Descrição clara do problema

**Passos para Reproduzir**
1. Vá para '...'
2. Clique em '...'
3. Veja o erro

**Comportamento Esperado**
O que deveria acontecer

**Screenshots**
Se aplicável, adicione screenshots

**Ambiente**
- OS: [ex: iOS]
- Browser: [ex: chrome, safari]
- Versão: [ex: 22]
```

## 💡 Sugerindo Funcionalidades

Para novas funcionalidades:
- Descreva o problema que resolve
- Explique a solução proposta
- Considere alternativas
- Avalie impacto na performance

## 🏗️ Arquitetura do Projeto

### Frontend (client/)
- React com TypeScript
- Componentes em `src/components/`
- Páginas em `src/pages/`
- Hooks customizados em `src/hooks/`

### Backend (server/)
- Express com TypeScript
- Rotas organizadas por funcionalidade
- WebSocket para tempo real
- Autenticação com Passport.js

### Banco de Dados
- PostgreSQL com Drizzle ORM
- Schemas em `shared/schema.ts`
- Migrações automáticas

## 📚 Recursos Úteis

- [Documentação React](https://react.dev/)
- [Documentação TypeScript](https://www.typescriptlang.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [shadcn/ui](https://ui.shadcn.com/)

## 📞 Ajuda

- Abra uma issue para dúvidas
- Consulte a documentação no README.md
- Entre em contato: suporte@servmotors.com

Obrigado por contribuir! 🚀