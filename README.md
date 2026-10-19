# Lava-Rápido do Carille

Site responsivo com identidade visual azul e branca, catálogo de serviços, consulta de horários, gravação de reservas e integração preparada para confirmação automática pela WhatsApp Cloud API.

## Requisitos
- Node.js 18 ou superior
- Conta Meta Business / WhatsApp Cloud API para envio automático real

## Executar localmente
1. Extraia o ZIP.
2. Abra a pasta no VS Code.
3. No terminal, execute `npm install`.
4. Copie `.env.example` para `.env`.
5. Execute `npm start`.
6. Abra `http://localhost:3000`.

As reservas são guardadas em `data/bookings.json`. Os horários funcionam de segunda a sexta, das 08h às 18h, e sábado das 08h às 16h, com intervalo das 12h às 13h. Domingo fechado. Ajuste em `server.js` conforme o expediente real.

## Configurar confirmação automática no WhatsApp
O envio automático exige credenciais oficiais da Meta e um template aprovado. Não é possível ativar isso só com o código do site.
1. No Meta for Developers, crie/configure um app com WhatsApp.
2. Obtenha o **Phone Number ID** e um **Access Token** apropriado.
3. Crie e aprove um template de categoria Utility. Configure-o com quatro variáveis no corpo, nesta ordem:
   `Olá {{1}}! Seu agendamento de {{2}} foi confirmado para {{3}} às {{4}}.`
4. Preencha no `.env`:
   - `WHATSAPP_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_TEMPLATE_NAME` (nome exato do template aprovado)
   - `WHATSAPP_TEMPLATE_LANGUAGE` (normalmente `pt_BR`)
5. Reinicie o servidor.

O token fica no servidor e não deve ser colocado em `public/app.js`. Para mensagens iniciadas pela empresa fora da janela de atendimento, use template aprovado e siga as regras da Meta. Em produção, configure HTTPS, armazenamento persistente, backup, proteção contra abuso e autenticação forte para administração.

## Personalizar o número de contato
Edite `businessWhatsApp` no início de `public/app.js` e informe o número do negócio em formato internacional, apenas dígitos (por exemplo `5511999999999`). Esse número é usado nos links de contato do site.

## Administração básica
Existe uma rota de leitura e cancelamento em `/api/admin/bookings`, protegida por `ADMIN_KEY`. Para habilitar:
1. Adicione `ADMIN_KEY=uma-chave-forte` ao `.env`.
2. Faça GET `/api/admin/bookings` com o cabeçalho `x-admin-key`.
3. Para cancelar, faça PATCH `/api/admin/bookings/CODIGO/cancel` com o mesmo cabeçalho.

Não exponha a chave no frontend. Para um painel administrativo visual, implemente autenticação de usuário no servidor antes de publicar.

## Importante antes de publicar
- Atualize telefone, endereço, expediente e preços.
- Teste conflitos de horários e envio de mensagens.
- O arquivo JSON é apropriado para protótipo/uso pequeno; para produção com múltiplos atendentes, prefira banco de dados como PostgreSQL.
