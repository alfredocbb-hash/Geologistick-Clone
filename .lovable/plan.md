

# Asistente IA de Soporte para Administradores

## Concepto
Crear un chatbot de IA integrado dentro del panel de administración que permita a los administradores hacer consultas sobre configuración, diagnosticar problemas (como el caso de cobertura de Bahía Blanca), y solo escalar a soporte humano cuando el asistente no pueda resolver.

El asistente tendrá acceso al contexto del tenant (sucursales, zonas, tarifas, envíos) para dar respuestas precisas y contextualizadas.

## Arquitectura

```text
┌──────────────────────────┐
│  Floating Chat Button    │  (esquina inferior derecha del dashboard)
│  → Abre panel de chat    │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  Chat Panel Component    │  (slide-up drawer / sheet)
│  - Historial mensajes    │
│  - Input de texto        │
│  - Botón "Contactar      │
│    Soporte" (escalación) │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  Edge Function           │  supabase/functions/admin-assistant
│  - Recibe mensaje +      │
│    tenant_id              │
│  - Consulta DB para      │
│    contexto (sucursales,  │
│    zonas, tarifas, etc)   │
│  - Llama a Gemini/GPT    │
│    con system prompt +    │
│    contexto del tenant    │
│  - Devuelve respuesta    │
└──────────────────────────┘
```

## Cambios

### 1. Edge Function: `supabase/functions/admin-assistant/index.ts`
- Recibe `{ message, conversation_history, tenant_id }` del frontend
- Consulta datos relevantes del tenant via Supabase (sucursales, zonas de cobertura, tarifas habilitadas, configuración)
- Construye un system prompt con contexto real del tenant
- Llama a Lovable AI (modelo `google/gemini-2.5-flash`) con el historial de conversación
- Responde con la respuesta del modelo en streaming o texto completo

### 2. Nuevo componente: `src/components/assistant/AdminAssistant.tsx`
- Floating action button (icono `MessageCircle`) en la esquina inferior derecha
- Al clickear abre un `Sheet` lateral con:
  - Header con título "Asistente" y botón cerrar
  - Area de mensajes scrollable con markdown rendering
  - Input de texto + botón enviar
  - Botón "Contactar Soporte Humano" que redirige a `/support` o abre WhatsApp
- Mantiene historial de conversación en estado local (no persistido)
- Envía todo el historial en cada request para mantener contexto

### 3. Integrar en `src/components/layout/DashboardLayout.tsx`
- Agregar `<AdminAssistant />` para que aparezca en todas las páginas del dashboard
- Solo visible para usuarios con rol `admin` o `super_admin`

### 4. Nueva ruta NO necesaria
- El asistente es un componente flotante, no una página

## System Prompt del Asistente
El prompt incluirá:
- Rol: asistente de soporte técnico de la plataforma de logística
- Conocimiento de las funcionalidades (zonas de cobertura, tarifas, sucursales, envíos, etc.)
- Datos en tiempo real del tenant consultados desde la DB
- Instrucción de recomendar contactar soporte humano cuando no pueda resolver

## Flujo de Escalación
1. Usuario pregunta al asistente
2. Si el asistente puede resolver (configuración, diagnóstico) → responde directamente
3. Si detecta un bug o no puede resolver → sugiere "Contactar Soporte" con botón que abre WhatsApp o formulario de soporte con el contexto de la conversación pre-cargado

