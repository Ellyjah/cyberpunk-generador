# cyberpunk-generador: desarrollo y traspaso

Documento vivo del generador de personajes. Está escrito para que **Codex (o cualquier agente) pueda continuar el trabajo** si Claude Code se queda sin cuota. Al terminar cada paso, actualiza la bitácora y la sección «Cómo retomar».

## Encargo y decisiones del director (2026-11-08)

El director pidió un generador lo más completo posible para PJ y PNJ. Debe cubrir los tres métodos de creación de Cyberpunk RED e incluir botones para que jugadores y DJ hagan las tiradas. Antes de escribir código se le consultó, y decidió lo siguiente:

| Tema | Decisión |
|---|---|
| Ubicación | Módulo nuevo e independiente, con id **`cyberpunk-generador`** (sin sufijo). No va dentro de `edgerunners-2070`. |
| Dependencias | Solo el sistema `cyberpunk-red-core`. Si `edgerunners-2070` está activo, se aplican sus reglas de creación; el generador **no depende** de ese módulo. |
| PNJ | Dos vías: las plantillas de amenaza del libro (secuaces, lugartenientes, minijefes y jefes) con variaciones, y la generación rápida por rol con el método Rata callejera. |
| Quién crea los PJ | El DJ y los jugadores. Un jugador **solo trabaja sobre una ficha existente** de la que el DJ le haya dado la propiedad, y los cambios van a esa ficha. Los jugadores nunca crean actores. |
| Tiradas | Un ajuste del DJ elige entre «Tirar o elegir» y «Solo tiradas». Todas las tiradas salen en el chat, y el DJ puede autorizar que se repita una. |
| Motor 2070 activo | Neuropuerto de creación gratis y sin −2 de Humanidad máxima, implantes marcados como instalados en la creación y pérdida media de Humanidad (ver `03-coordinacion/REGLAS.md`, líneas sobre la creación, y `CONTRATOS.md`, sobre `install` y `creationFree`). |
| Equipo | Edgerunner usa las listas del libro por rol. Paquete completo usa una tienda con los compendios de RED, que salen en español gracias a `cyberpunk-tr-esp`, con control de presupuesto y límites. |
| Vida pasada | Completa: la general más la propia de cada uno de los 10 roles, escrita en los campos `system.lifepath.*` de la ficha de RED. |

**Naturaleza del módulo:** las tablas del libro (vida pasada, plantillas de rata callejera, listas de equipo, PNJ) son contenido comercial. Por eso este es un **módulo privado de contenido**, igual que `cyberpunk-red-core-esp`. No se publica en ningún repositorio público. El repositorio de GitHub, si el director lo autoriza, será privado. No aplica la regla del motor de no llevar contenido, que es solo para `edgerunners-2070`.

## Plan por pasos

1. **Esqueleto, permisos y ajustes.** ✅ 0.1.0.
2. **Tablas de PJ en datos** (`data/*.json`), extraídas del Core en español y cotejadas. ✅ (las tablas de PNJ se extraen en el paso 6).
3. Rata callejera y vida pasada (tiradas en el chat y política de tiradas), probados en el banco.
4. Edgerunner.
5. Paquete completo con tienda.
6. PNJ.
7. Integración con el motor 2070.
8. Pruebas completas y copias habituales (proyecto, Raspberry, V12 con el mundo cerrado, GitHub privado; esto último, previa autorización).

## Arquitectura (estado actual)

```
06-cyberpunk-generador/
  module.json            id cyberpunk-generador, Foundry V12 (12.343), sistema cyberpunk-red-core v0.92.4, socket
  scripts/main.js        hooks: init (ajustes y API), ready (socket), botón de cabecera de ficha, botón del directorio (DJ)
  scripts/settings.js    ajustes de mundo: rollPolicy ("free" | "rollsOnly"), playersEnabled (Boolean)
  scripts/socket.js      canal DJ: gmExec/registerHandler/listenSocket (mismo patrón que edgerunners-2070/effects.js)
  scripts/wizard.js      GeneratorWizard (ApplicationV2 + HandlebarsApplicationMixin), openGenerator, userCanUse
  scripts/logic/core.js  lógica pura sin Foundry: constantes, permisos, borrador, navegación (probada con node)
  templates/wizard.hbs   barra de pasos, cuerpo del paso, pie con Anterior/Siguiente
  styles/generador.css   solo estructura; los colores son los del tema
  lang/es.json, en.json  claves CPRGEN.*
  tests/*.test.mjs       node --test tests/*.test.mjs
  tools/bench/*.mjs      pruebas Playwright en el banco 30013
  tools/extract_core_tables.py  genera data/*.json desde el Core en español (paso 2)
  tools/check_pdf_stats.py      cotejo de las tablas de características con el PDF
  data/*.json            tablas de creación (generadas; no editar a mano)
```

**Estado del asistente:** todo lo elegido se guarda en la bandera `flags.cyberpunk-generador.draft` del actor, con la forma `{schema: 1, method, step, data, rolls}`.
- Se puede cerrar y retomar.
- El DJ y el jugador propietario ven el mismo progreso, porque el asistente se redibuja con `updateActor`.
- **Nada se escribe en `system` de la ficha hasta el paso «Revisión»** (paso 7 del asistente), que aplicará todo de una vez.
- Si cambia la forma del borrador, sube `DRAFT_SCHEMA` en `logic/core.js`. `normalizeDraft` descarta los borradores de otro esquema.

**Permisos** (`canUseGenerator`):
- El DJ puede usarlo sobre fichas `character` y `mook`.
- Un jugador solo puede usarlo si se cumplen las tres condiciones: `playersEnabled`, es propietario y la ficha es `character`.
- El botón «Generador de personajes» del directorio de actores (que crea una ficha) solo lo ve el DJ.

**API:** `game.modules.get("cyberpunk-generador").api.open(actor)`.

**Pasos del asistente** (`STEPS`): method → role → stats → skills → lifepath → gear → review. Métodos (`METHODS`): `streetrat`, `edgerunner`, `complete`.

## Datos (`data/*.json`)

**No se editan a mano.** Los genera `python -I tools/extract_core_tables.py` (desde la raíz del módulo) a partir del Core en español sellado, la edición 1.0.2: `02-edgerunners-world/staging/P02A21-audit-fixes-101/cyberpunk-red-core-esp/source/journals.json`. Las habilidades se resuelven contra el volcado de compendios de RED v0.92.4 (`05-cyberpunk-tr-esp-work/source/red-core-dump.json`).
- El extractor se detiene ante cualquier discrepancia y no escribe nada a medias.
- Es idempotente.
- `rules.json` guarda el SHA-256 de ambas fuentes.

| Archivo | Contenido |
|---|---|
| `roles.json` | Los 10 roles. Cada uno lleva: `key` (fixer, exec, solo, netrunner, nomad, media, lawman, rockerboy, tech, medtech), nombre del Core, `uuid` del Item de `core_roles` y `statTable` (10 filas con las claves de RED `int ref dex tech cool will luck move body emp`). También `streetratSkills` (20 entradas `{label, red?, specialtyPack?, level}`) y `edgerunnerSkills` (las mismas 20, sin nivel). `weapons`, `gear` y `cyberware` son líneas: `{options:[{uuid,name,qty,note}], prefix?}`; varias opciones equivalen a «elige una», y la ropa va como `{clothing:{style, items:[{type,qty}]}, text}`. Por último, `cyberwareHumanityLoss` y `cyberwareEmpLoss` (lo que calcula el libro) y `lifepath` (los nodos de la vida pasada de rol, ver abajo). |
| `lifepath.json` | 15 secciones de vida pasada general en el orden del libro. Cada una lleva `{id, title, instruction, die, columns, rows:[{min,max,cells}], fields}`. `fields` asigna cada columna a un campo `system.lifepath.*` de RED. Campos opcionales: `count: "1d10-7"` (amigos, enemigos, amores: se tira el recuento y luego una vez por entrada), `choose` (columnas que se eligen en lugar de tirar), `then`/`perEnemy` (la venganza se tira por cada enemigo) y `languageOptions` (los idiomas de cada región, para la habilidad de idioma a nivel 4). |
| `skills.json` | Las 66 habilidades de la lista del Core: `{name, stat, x2, red, redId, basic}`, o `specialtyPack` para Artes marciales, Ciencia y Tocar instrumento (la especialidad se elige en el compendio de RED indicado). |
| `rules.json` | Constantes de los métodos: aptitud de rol 4; idioma de origen 4; habilidades 86 puntos entre 2 y 6, con mínimo 2 en las básicas; paquete completo con características entre 2 y 8, puntos por rango de personaje (principiante 62), 2550 ed y 800 ed de moda; 500 ed extra para rata callejera y edgerunner; alojamiento y estilo de vida iniciales (con un caso propio para el ejecutivo). |

**Nodos de la vida pasada de rol:**
- `{type:"table", id:"t<n>", title, instruction, die, columns, rows}`;
- `{type:"choice", id, title, options:[{value,label}]}`, para las decisiones del «Recorrido de las decisiones» del Core (socio o solo, tierra/aire/mar, grupo o solitario…).

Un nodo con `when:{id, value}` solo se recorre si la decisión `id` vale `value`. Las decisiones están escritas en `ROLE_FLOW` del extractor, y se comprueba el número de tablas de cada rol.

**Cotejo independiente:** `python -I -W ignore tools/check_pdf_stats.py` comprueba que las 100 filas de características aparecen en el PDF del libro básico (PDF 78–81).

**Páginas del Core usadas** (`_id`):

| Contenido | `_id` |
|---|---|
| Características por rol | `c7d392fb3b0523db` |
| Habilidades de rata callejera | `fe24adb1816ab8f4` |
| Habilidades del edgerunner | `c5d25d1e04982fcc` |
| Habilidades del paquete completo | `76c00c7d1ac0a4eb` |
| Lista de habilidades | `1002f3699444b7ba` |
| Armas y blindaje iniciales | `4a25d7645c5fd196` |
| Ropa, equipo y alojamiento iniciales | `7153fd1d59d36712` |
| Ciberequipo inicial | `32e92d6a0b5a4148` |
| Vida pasada general | `556dabf81b249488`, `994c0f60ff144b8f`, `03f931e03bee71f4`, `97c0e8973496e0a1` |
| Vida pasada de cada rol | la columna `lifepathPage` de `roles.json` |

**Peculiaridades del Core que maneja el extractor:**
- En Nómada, las habilidades de rata y de edgerunner traen el mismo conjunto en distinto orden.
- La tabla de Edgerunner del tecnomédico trae una fila de encabezado que las demás no tienen.
- Tras el encabezado «Tecnomédico» siguen tablas de ejemplo (Jay); se toma solo la primera tabla de cada encabezado.
- La tabla de ciberequipo tiene dos filas: la lista y la pérdida de Humanidad.

**PNJ (paso 6):** el Core en journals **no** incluye las fichas de PNJ del capítulo del DJ. Están en el PDF del libro básico, en «Tipejos y reclutas», páginas impresas 412–416, que son las PDF 416–420. Hay 10 fichas: Pandillero, Guardaespaldas, Operativo de seguridad, Pandillero de carretera, Jefe de recuperadores, Netrunner, Oficial de seguridad, Piloto, Ciberpsicópata y Pirómano. Las variaciones están en las tablas de encuentros que siguen (por ejemplo, PDF 424: «usa guardaespaldas; sustituye…»).

**Ficha de RED:** solo trae campos de texto de vida pasada (`system.lifepath.culturalOrigin`, `personality`, `clothingStyle`, `hairStyle`, `affectations`, `valueMost`, `aboutPeople`, `valuedPerson`, `valuedPossession`, `familyBackground`, `childhoodEnvironment`, `familyCrisis`, `lifeGoals`, `friends`, `enemies`, `tragicLoveAffairs`, `roleLifepath`). RED no trae tablas ni asistente.

**Ropa (resuelto):** la ropa del equipo inicial está en texto («Ropa de deporte: calzado x2…»). `core_clothing` de RED tiene exactamente 10 estilos × 9 tipos (90 Items, con `system.style` y `system.type`), así que en el paso 3 cada línea se convierte en su Item nativo. Faltan las dos tablas de correspondencia en español. Estilos: Ropa normal elegante=`genericChic`, Ropa de deporte=`leisurewear`, Tendencias urbanas=`urbanFlash`, Ropa de negocios=`businesswear`, Alta costura=`highFashion`, Ropa bohemia=`bohemian`, Ropa de mendigo=`bagLadyChic`, Colores de pandilla=`gangColors`, Cuero nómada=`nomadLeathers`, Moda asiática=`asiaPop`. Tipos: parte de arriba=`top`, chaqueta=`jacket`, calzado=`footwear`, gafas=`glasses`, parte de abajo=`bottoms`, sombrero=`hats`, joyas=`jewelry`, lentes de contacto=`contactLenses`, gafas espejadas=`mirrorshades`. Hay que comprobar los nombres exactos que aparecen en `roles.json` antes de dar la correspondencia por cerrada.

## Pruebas

- **Unitarias:** `cd 06-cyberpunk-generador && node --test tests/*.test.mjs`.
- **Banco 30013** (propio de Claude; Codex usa el 30012).
  - Datos: `/home/joselu/SSD/foundry-pruebas-edgerunners/`, mundo `edgerunners-2070-pruebas`.
  - Instalar: `tar -cf - module.json scripts templates styles lang data | ssh … 'M=/home/joselu/SSD/foundry-pruebas-edgerunners/Data/modules/cyberpunk-generador; rm -rf $M; mkdir -p $M; tar -xf - -C $M'`.
  - Arrancar: `sudo -n systemd-run --unit=foundry-edgerunners-pruebas --uid=joselu --property=Group=joselu --property=TimeoutStopSec=90 --working-directory=/home/joselu/SSD/foundryv12/resources/app --collect /home/joselu/SSD/foundry-runtimes/node-v20.20.2-linux-arm64/bin/node /home/joselu/SSD/foundryv12/resources/app/main.js --dataPath=/home/joselu/SSD/foundry-pruebas-edgerunners --port=30013 --noupnp --noipdiscovery --noupdate`.
  - Túnel: `ssh -N -L 30013:127.0.0.1:30013 joselu@ellyjah.ddns.net`; se cierra por su PID verificado, nunca por nombre.
  - Parar: `sudo -n systemctl stop foundry-edgerunners-pruebas`.
  - Lanzar el mundo: `POST /setup {action:"launchWorld", world:"edgerunners-2070-pruebas"}`.
  - Playwright está en `project_developement/tmp/foundry-v12-browser/node_modules`. Ejemplo: `node tools/bench/gen01-esqueleto.mjs <salida.json> <carpeta-capturas>`.
- **Usuarios del banco:** Gamemaster (DJ, sin contraseña), `[M10] Jugador`, `[M5] Jugadora`, `[M9] Jugador`.

## Bitácora

### 2026-11-08 — Paso 1: esqueleto, permisos y ajustes (0.1.0) — Claude Code

- **Hecho:**
  - módulo con manifiesto V12;
  - ajustes `rollPolicy` y `playersEnabled`;
  - canal de socket preparado (todavía sin manejadores);
  - asistente con los 7 pasos y selección de método: el cambio de método pide confirmación y descarta lo elegido;
  - navegación Anterior/Siguiente, con los pasos bloqueados hasta elegir método;
  - reinicio del borrador (solo el DJ);
  - botón «Generador» en la cabecera de la ficha y botón «Generador de personajes» en el directorio (solo el DJ: crea una ficha `character` y abre el asistente);
  - textos en español e inglés.
  
  Los pasos 2 a 7 del asistente muestran «todavía no disponible».
- **Pruebas:**
  - unitarias 4/4;
  - `node --check` y JSON válidos;
  - banco 30013 (`tools/bench/gen01-esqueleto.mjs`), con estos resultados:
    - módulo activo y API presente; botón del directorio visible para el DJ y no para el jugador;
    - botón de cabecera para el DJ, y para el jugador solo en su ficha (no en una ficha ajena con permiso de observador);
    - la apertura por API sobre una ficha ajena se niega;
    - el jugador ve el progreso del DJ, y el DJ ve el cambio del jugador sin recargar;
    - con `playersEnabled` desactivado, el jugador pierde el botón;
    - el reinicio borra la bandera;
    - 0 errores de página. Captura revisada.
- **Nota:** en el banco, el cliente del DJ estaba en inglés. Los textos en español se comprobarán en la prueba del paso 3.
- **Sin tocar:** `edgerunners-2070` (Codex trabaja en él) ni los registros compartidos `ESTADO.md` y `PRUEBAS.md`. El director pidió no escribir en ellos por ahora. Solo se ha creado el aviso nuevo `03-coordinacion/GENERADOR-PERSONAJES.md`, que remite a este documento.
- **Git:** repositorio local en esta carpeta. Sin remoto ni push (pendiente de autorización del director).

### 2026-11-08 — Paso 2: tablas de PJ en datos — Claude Code

- **Hecho:**
  - `tools/extract_core_tables.py` genera `data/roles.json`, `lifepath.json`, `skills.json` y `rules.json` (formato en «Datos»);
  - 10 roles: tabla de características, 20 habilidades de rata callejera con nivel y las mismas 20 de edgerunner, armas y blindaje, equipo, ciberequipo con la pérdida de Humanidad del libro, y vida pasada de rol con decisiones y condiciones (52 tablas y 7 decisiones);
  - 15 secciones de vida pasada general, cada una con su campo de RED;
  - las 66 habilidades, con correspondencia con RED comprobada por característica y por coste doble (x2);
  - todas las opciones de equipo enlazan un Item nativo existente en los compendios de RED.
- **Pruebas:**
  - unitarias 10/10 (`tests/data.test.mjs`: integridad, básicas presentes, niveles 2–6, rangos de dado completos, condiciones con su decisión, UUID con formato válido);
  - extractor idempotente;
  - cotejo con el PDF: 100/100 filas de características.
- **Decisión técnica:** los datos se generan del Core en lugar de copiarse a mano, y el extractor se detiene ante cualquier discrepancia. Las cuatro peculiaridades del Core encontradas están documentadas en «Datos».
- **Pendiente:** la ropa se convierte en Items en el paso 3 (correspondencia en «Datos»); las tablas de PNJ, del PDF, en el paso 6.

## Cómo retomar

1. Lee este documento y `module.json`.
2. Ejecuta las pruebas unitarias y, si cambias el extractor, vuelve a generar los datos.
3. Siguiente: **paso 3, Rata callejera y vida pasada.**
   - Carga los datos con `fetch("modules/cyberpunk-generador/data/…")`.
   - **Paso Rol:** lista de los 10 roles.
   - **Paso Características:** botón «Tirar 1d10» (tirada de Foundry al chat) que fija la fila; con la política `free`, también selector de fila.
   - **Paso Habilidades:** muestra la plantilla y pide elegir especialidad (Ciencia o Tocar instrumento) e idioma de origen.
   - **Paso Vida pasada:** la general y la de rol, nodo a nodo, cada tabla con «Tirar» y, si la política lo permite, «Elegir»; amigos, enemigos y amores con recuento.
   - **Paso Equipo:** elegir entre las opciones.
   - **Paso Revisión:** aplicar a la ficha. Esto incluye: características (RED las guarda en `system.stats.<clave>.value`; compruébalo en el código de RED), habilidades (Items `skill` que RED crea en la ficha, ajustando `system.level`), rol (Item de `core_roles` con la aptitud a 4), equipo (Items de los compendios), vida pasada (`system.lifepath.*`), dinero (500 ed) y alojamiento.
   - **Repetir una tirada:** con la política `rollsOnly`, solo el DJ, o el jugador con autorización del DJ por socket.
4. No escribas en `edgerunners-2070` ni en ESTADO/PRUEBAS sin confirmar con el director que Codex ha terminado.
