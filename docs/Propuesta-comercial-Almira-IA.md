# Propuesta comercial — Almira IA + panel de control

**Cliente:** Altamira Group  
**Proveedor:** Luis Guareschi  
**Fecha:** 22 de agosto de 2026 · **Validez:** 20 días

| | |
| --- | --- |
| Alcance | MVP: WhatsApp + HubSpot + Calendly + panel de control |
| Piloto | Altavida Norte (formularios Meta → WhatsApp) |
| Plazo | 7–8 semanas desde kickoff con accesos |
| Inversión | **USD 24.000** (200 h × USD 120) |
| Terceros | WhatsApp, HubSpot, IA y hosting los paga Altamira |

Almira atiende el lead, lo preclasifica y lo deriva a visita o asesor. No reemplaza al equipo comercial.

---

## Qué incluye

**1. Agente Almira (WhatsApp)**  
Usa el prompt maestro y las FAQ ya existentes.

- Se presenta, pregunta vivir / invertir y detecta el proyecto.
- Responde corto (2–3 datos + precio desde + web + Calendly).
- Deriva a asesor si piden detalle (planes, expensas, rentabilidad, planos) o a la 3ª consulta fina.
- Un follow-up a los 10 minutos si no responden.
- Alquiler solo en Luque, Surubi’i (torres entregadas) y Alzara.
- No agenda ni modifica turnos en Calendly.

**2. Canal del piloto**  
Formularios pagos de Facebook / Instagram de Altavida Norte: alta del lead, plantilla de primer contacto y conversación. WhatsApp orgánico también queda cubierto para no perder esos chats. El resto de canales (web, mailing, TikTok, etc.) queda para una fase siguiente.

**3. HubSpot**  
Crea o actualiza el contacto y escribe: nombre, teléfono, email, proyecto, estado, origen/campaña, venta/alquiler, presupuesto, tipología, objetivo y un resumen del chat.

Estados que mueve Almira: `Almira activada`, `Solicita asesor`, `Visita agendada`, `Inválido`, `Perdido`. El resto sigue en el equipo humano.

**4. Calendly**  
Comparte el link correcto de cada proyecto. No se integra la API para crear o cambiar reservas.

**5. Panel de control**  
Bandeja con búsqueda y filtros (estado, proyecto, canal, fecha). Detalle del hilo + ficha HubSpot. Toma humana (pausar / reactivar Almira). Configuración de precios, Calendly y plantillas sin deploy. Login con roles admin y operador.

Si el mock-up llega a tiempo se usa de referencia; si no, se entrega una UI funcional y se ajusta en UAT.

---

## Fuera de alcance

GHL → BUZZ, otros canales inbound, Messenger/Instagram DM, agendamiento nativo en Calendly, reportes de marketing, app mobile, limpieza histórica de HubSpot y soporte 24/7.

---

## Plazo

| Semanas | Entrega |
| --- | --- |
| 1 | Kickoff, accesos, arquitectura |
| 2–3 | Almira + WhatsApp + plantillas del piloto |
| 4 | HubSpot + Calendly |
| 5–6 | Panel de control |
| 7 | UAT con inbound |
| 8 | Ajustes, producción y capacitación |

Para empezar hacen falta: WhatsApp Business, acceso HubSpot, usuarios del panel, precios/Calendly vigentes y 8–10 chats de prueba.

---

## Inversión

Precio cerrado sobre este alcance.

| Ítem | Horas | USD |
| --- | ---: | ---: |
| Kickoff y arquitectura | 26 | 3.120 |
| WhatsApp + Almira + piloto Norte | 58 | 6.960 |
| HubSpot + Calendly | 30 | 3.600 |
| Panel de control | 40 | 4.800 |
| UAT, go-live y coordinación | 46 | 5.520 |
| **Total** | **200** | **24.000** |

**Pago:** 40% al inicio (USD 9.600) · 40% al entrar a UAT (USD 9.600) · 20% al go-live (USD 4.800).  
Montos en USD, sin impuestos ni costos de terceros.

**Mantenimiento opcional** (desde la 3ª semana post go-live): 8 h/mes USD 960, o 12 h/mes USD 1.440. Las 2 primeras semanas de estabilización ya van en el MVP.

---

## Criterio de aceptación

En Altavida Norte:

1. El lead de Meta recibe la plantilla y Almira continúa el chat.
2. HubSpot queda con ficha, estado y resumen.
3. Se envía el Calendly correcto.
4. Un caso de detalle pasa a `Solicita asesor` y Almira se detiene.
5. Inbound ve el hilo en el panel y abre el contacto en HubSpot.
6. Un admin actualiza precio o Calendly sin tocar código.

---

## Siguiente paso

Reunión corta para confirmar piloto, accesos y fecha de kickoff. Con eso se puede empezar la semana siguiente.
