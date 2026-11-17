# Cambios — cyberpunk-generador

## 1.0.1 — 2026-11-17

Corrección H01 de la auditoría global de Codex: una aplicación interrumpida ya no deja la ficha a medias ni duplica al reintentar.

- Todo lo que viene de los compendios (habilidades, rol, equipo, ropa y neuropuerto) se resuelve antes de escribir. Si algo falla, la ficha queda intacta y la generación anterior se conserva.
- Antes de la primera escritura se guarda un registro «pendiente» con las habilidades base que se van a tocar. Si una escritura falla, el reintento deshace lo generado y aplica de nuevo, sin roles, habilidades ni dinero duplicados, y sin pedir autorización al DJ por ser una aplicación que no terminó.
- La devolución del dinero de la aplicación anterior y el cobro de la nueva van en la misma actualización que su registro.
- No se aplican dos veces a la vez en la misma ficha.
- `module.json` lleva ya sus direcciones de proyecto, manifiesto y descarga, como el de la release.

## 1.0.0 — 2026-11-08

Primera versión completa. Recoge los pasos 1 a 7 del desarrollo y las pruebas del paso 8. El detalle está en [DESARROLLO.md](DESARROLLO.md).

- **Personajes jugadores:** los tres métodos del Libro de reglas.
  - **Rata callejera.**
  - **Edgerunner:** una tirada por característica y 86 puntos de habilidad.
  - **Paquete completo:** puntos de característica según el rango, 86 puntos de habilidad y tienda con dos presupuestos.
  - Vida pasada general y de rol, con decisiones.
- **Tiradas:** salen en el chat. Política «Tirar o elegir» o «Solo tiradas», con repetición autorizada por el DJ.
- **Aplicación a la ficha de RED:**
  - características, Humanidad, habilidades y rol;
  - equipo, ropa y ciberequipo instalado;
  - dinero, alojamiento y vida pasada.
  
  Volver a aplicar sustituye la aplicación anterior y requiere la autorización del DJ.
- **Jugadores:** solo sobre fichas propias, y únicamente con el ajuste «Autorizar a los jugadores» (desactivado por defecto; al cerrarlo, el botón desaparece al momento).
- **PNJ (solo DJ):**
  - las 10 fichas de «Tipejos y reclutas»;
  - encuentros aleatorios de Night City (tres tablas);
  - PNJ rápido por rol;
  - en ficha de secuaz o de personaje completo.
- **Partida de Edgerunners** (ajuste): arsenal del Mission Kit y objetos de RED al doble, y neuropuerto de creación gratis. Requiere Edgerunners 2070 y Edgerunners Mission Kit.
- **Requisitos:** solo Cyberpunk RED – Core (v0.92.4) en Foundry V12.

### Versiones de desarrollo

- 0.1.0: esqueleto, permisos y ajustes.
- 0.2.0: Rata callejera y vida pasada.
- 0.3.0: Edgerunner.
- 0.4.0: Paquete completo, sustitución autorizada y prueba con solo RED.
- 0.5.0: PNJ.
- 0.6.0: Partida de Edgerunners.
