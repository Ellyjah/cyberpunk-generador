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
3. **Rata callejera y vida pasada** (tiradas en el chat, política de tiradas, repetición autorizada, aplicación a la ficha). ✅ 0.2.0.
4. **Edgerunner** (una tirada por característica, 86 puntos de habilidad, mismo equipo que Rata callejera). ✅ 0.3.0.
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
  scripts/wizard.js      GeneratorWizard (ApplicationV2 + HandlebarsApplicationMixin): contexto de cada paso, acciones
                         (tirar, elegir, pedir repetir, aplicar) y manejador de socket «rerollRequest»
  scripts/data.js        carga de data/*.json y de índices de compendios de RED (especialidades, idiomas)
  scripts/rolls.js       tirada de Foundry publicada en el chat a nombre del actor
  scripts/apply.js       buildPlan (borrador → plan) y applyPlan (plan → ficha de RED)
  scripts/logic/core.js  lógica pura: constantes, permisos, borrador (texto JSON), navegación, rollRights
  scripts/logic/lifepath.js  huecos de vida pasada, filas por tirada, condiciones, texto para system.lifepath.*
  scripts/logic/streetrat.js plan de Rata callejera: elecciones pendientes, equipo, ropa → core_clothing
  scripts/logic/methods.js   por método: missingFor, planFor; Edgerunner: características por columna, coste y reparto
  templates/wizard.hbs   barra de pasos, cuerpo del paso, pie con Anterior/Siguiente
  styles/generador.css   solo estructura; los colores son los del tema
  lang/es.json, en.json  claves CPRGEN.*
  tests/*.test.mjs       node --test tests/*.test.mjs
  tools/bench/*.mjs      pruebas Playwright en el banco 30013
  tools/extract_core_tables.py  genera data/*.json desde el Core en español (paso 2)
  tools/check_pdf_stats.py      cotejo de las tablas de características con el PDF
  data/*.json            tablas de creación (generadas; no editar a mano)
```

**Estado del asistente:** todo lo elegido se guarda en la bandera `flags.cyberpunk-generador.draft` del actor, **como texto JSON**, con la forma `{schema: 1, method, step, data: {role, answers, grants}, rolls, appliedAt?}`.
- Es texto porque Foundry trata los puntos de las claves («g.style.c0») como rutas y, al fusionar objetos, no borra claves viejas. Un texto se sustituye entero. `normalizeDraft` acepta también el objeto de 0.1.0.
- `answers`: claves de hueco → `{row}`, `{count}`, `{value}`, `{uuid, text}` o `{text}`, con `total` si salió de una tirada. Las claves están documentadas en la cabecera de `logic/lifepath.js` y `logic/streetrat.js`.
- `grants`: repeticiones concedidas por el DJ (se consumen al tirar). `rolls`: registro de cada tirada (clave, total, usuario y fecha).
- Se puede cerrar y retomar.
- El DJ y el jugador propietario ven el mismo progreso, porque el asistente se redibuja con `updateActor`.
- **Nada se escribe en `system` de la ficha hasta el paso «Revisión»** (paso 7 del asistente), que aplicará todo de una vez.
- Si cambia la forma del borrador, sube `DRAFT_SCHEMA` en `logic/core.js`. `normalizeDraft` descarta los borradores de otro esquema.

**Permisos** (`canUseGenerator`):
- El DJ puede usarlo sobre fichas `character` y `mook`.
- Un jugador solo puede usarlo si se cumplen las tres condiciones: `playersEnabled`, es propietario y la ficha es `character`.
- El botón «Generador de personajes» del directorio de actores (que crea una ficha) solo lo ve el DJ.

**API:** `game.modules.get("cyberpunk-generador").api.open(actor)`.

**Pasos del asistente** (`STEPS`): method → role → stats → skills → lifepath → gear → review. Métodos (`METHODS`): `streetrat`, `edgerunner`, `complete`. `IMPLEMENTED` en `wizard.js` dice qué pasos están hechos para cada método. Los demás muestran «todavía no disponible».

**Tiradas** (`rollRights`):
- Un hueco vacío lo puede tirar cualquiera.
- Si ya tiene valor: el DJ siempre; con «Tirar o elegir», cualquiera; con «Solo tiradas», solo con permiso del DJ. El jugador pulsa «Pedir repetir», el DJ activo recibe un diálogo por socket y, si acepta, se escribe la concesión en `grants` y se envía un susurro a ambos.
- Elegir directamente en el desplegable: el DJ siempre, los demás solo con «Tirar o elegir». Las decisiones de la vida pasada de rol siempre se eligen, porque el libro no las tira.

**Aplicación a la ficha** (`apply.js`, paso «Revisión»). Escribe como lo haría RED y no borra nada de la ficha:
- características (`system.stats.*.value`, más `max` de SUE y EMP), Humanidad = EMP × 10 y PG = `actor.calcMaxHp()`;
- vida pasada en `system.lifepath.*` y alojamiento y estilo de vida en `system.lifestyle.housing` y `lifeStyle`;
- habilidades base: se ajusta `system.level` del Item `skill` de la ficha (por nombre interno, o por el nombre visible del compendio `internal_skills`); especialidades e idioma se añaden desde sus compendios;
- rol: Item de `core_roles` con `system.rank` 4 y `system.roleInfo.activeRole`;
- equipo de los compendios: los apilables con `system.amount`, los demás repetidos; armas y blindaje se equipan;
- ropa: `core_clothing` por `system.style` y `system.type`;
- ciberequipo: primero el fundacional, en la ficha; cada opción, en el fundacional de su tipo. Las ranuras base de RED (interno, externo, moda) cuentan como fundacionales. Se instala con `installItems`, sin el diálogo de RED, y después se aplica `loseHumanityValue(…, "static")`, la pérdida media; RED recalcula la Humanidad máxima y la EMP;
- dinero: +500 en el libro de cuentas `system.wealth`, con su apunte.

**Edgerunner** (`logic/methods.js`):
- Características: `stats.<clave>` → `{row}`, una tirada 1d10 por característica, en su columna de la tabla del rol.
- Habilidades: `skill.<etiqueta>` → `{level}`; sin respuesta vale 2, el mínimo. El coste es nivel × 1, o nivel × 2 en las habilidades con `x2`, como en los ejemplos del Core; el reparto de Jay del Core da exactamente 86 y está en las pruebas. Límites: 86 puntos y niveles entre 2 y 6; el asistente recorta el valor al rango y la revisión bloquea si se pasa del presupuesto. Los puntos sobrantes se permiten, porque el libro no obliga a gastarlos.
- Equipo, especialidades e idioma: los de Rata callejera (el Core da la misma lista a ambos métodos).

**Importante, fichas creadas por código:** hay que usar `Actor.implementation.create(…)` (la clase de RED). `Actor.create(…)` crea la ficha **sin** las 63 habilidades base ni las ranuras de ciberequipo. `applyPlan` se detiene con un aviso si la ficha no tiene habilidades base.

## Datos (`data/*.json`)

**No se editan a mano.** Los genera `python -I tools/extract_core_tables.py` (desde la raíz del módulo) a partir del Core en español sellado, la edición 1.0.2: `02-edgerunners-world/staging/P02A21-audit-fixes-101/cyberpunk-red-core-esp/source/journals.json`. Las habilidades se resuelven contra el volcado de compendios de RED v0.92.4 (`05-cyberpunk-tr-esp-work/source/red-core-dump.json`).
- El extractor se detiene ante cualquier discrepancia y no escribe nada a medias.
- Es idempotente.
- `rules.json` guarda el SHA-256 de ambas fuentes.

| Archivo | Contenido |
|---|---|
| `roles.json` | Los 10 roles. Cada uno lleva: `key` (fixer, exec, solo, netrunner, nomad, media, lawman, rockerboy, tech, medtech), nombre del Core, `uuid` del Item de `core_roles` y `statTable` (10 filas con las claves de RED `int ref dex tech cool will luck move body emp`). También `streetratSkills` (20 entradas `{label, red?, specialtyPack?, level}`) y `edgerunnerSkills` (las mismas 20, sin nivel). `weapons`, `gear` y `cyberware` son líneas: `{options:[{uuid,name,qty,note}], prefix?}`; varias opciones equivalen a «elige una», y la ropa va como `{clothing:{style, items:[{type,qty}]}, text}`. Por último, `cyberwareHumanityLoss` y `cyberwareEmpLoss` (lo que calcula el libro) y `lifepath` (los nodos de la vida pasada de rol, ver abajo). |
| `lifepath.json` | 15 secciones de vida pasada general en el orden del libro. Cada una lleva `{id, title, instruction, die, columns, rows:[{min,max,cells}], fields}`. `fields` asigna cada columna a un campo `system.lifepath.*` de RED. Campos opcionales: `count: "1d10-7"` (amigos, enemigos, amores: se tira el recuento y luego una vez por entrada), `perColumn` (cada columna se tira por separado: estilo, motivaciones, enemigos; sin él, una tirada da la fila entera), `wronged` (en enemigos, elección de la parte perjudicada), `then`/`perEnemy` (la venganza se tira por cada enemigo) y `languageOptions` (los idiomas de cada región, para la habilidad de idioma a nivel 4). |
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

### 2026-11-08 — Paso 3: Rata callejera y vida pasada (0.2.0) — Claude Code

- **Hecho:**
  - Paso Rol: los 10 roles; cambiar de rol conserva la vida pasada general.
  - Paso Características: tirada 1d10 en el chat, o fila elegida.
  - Paso Habilidades: plantilla, especialidad desde el compendio de RED, e idioma de origen desde `core_skills-languages` o escrito a mano.
  - Paso Vida pasada: general y de rol, con decisiones, recuentos, perjudicado y venganza por enemigo.
  - Paso Equipo: elección entre opciones.
  - Paso Revisión: lista de pendientes, resumen y «Aplicar a la ficha» (con aviso si ya se aplicó).
  - «Pedir repetir» por socket.
  - Los pasos de Rol y Vida pasada ya sirven para los tres métodos. Características, Habilidades, Equipo y Revisión de Edgerunner y Paquete completo quedan para los pasos 4 y 5.
- **Pruebas:**
  - unitarias 16/16 (`tests/streetrat.test.mjs`: filas por tirada, recuentos, condiciones de rol, huecos, texto de vida pasada, plan, correspondencia de toda la ropa);
  - banco 30013 (`tools/bench/gen03-rata-callejera.mjs`, Foundry 12.343, RED v0.92.4, motor 0.5.4 activo, Babele y `cyberpunk-tr-esp` activos, cliente en español), con un tecnomédico de punta a punta:
    - tirada de características en el chat;
    - Ciencia (Biología) e idioma;
    - 28 huecos de vida pasada (24 tiradas);
    - 4 elecciones de equipo;
    - aplicación: 21 habilidades con su nivel, rol con rango 4 y rol activo, 21 objetos, armas y blindaje equipados, 4 piezas de ciberequipo instaladas en su fundacional, Humanidad 80 − 12 = 68 con máximo 74 (regla de RED), 500 ed con apunte, alojamiento y los 17 campos de vida pasada;
    - jugador con «Solo tiradas»: tira, se bloquea, pide repetir, el DJ acepta (diálogo y susurro), repite y vuelve a quedar bloqueado;
    - 0 errores; capturas revisadas (vida pasada, revisión y ficha de RED).
- **Fallos encontrados y corregidos durante la prueba:**
  1. `foundry.utils.escapeHTML` no existe en V12 (el diálogo del DJ fallaba): escape propio.
  2. `Actor.create` no añade las habilidades base de RED: el botón del directorio y la prueba usan `Actor.implementation.create`, y `applyPlan` lo comprueba.
  3. El idioma salía duplicado en la vida pasada («Idioma: Idioma (Bengalí)»): se elige una sola vez, en Habilidades, y se limpia el nombre.
  4. En la vida pasada, el resultado quedaba en una columna estrecha: los botones van debajo.
  5. Los nombres tras «o» del Core empezaban en minúscula: mayúscula al mostrarlos.
  6. La pestaña Combate salía vacía: armas y blindaje se equipan.
- **Decisiones:**
  - Pérdida de Humanidad: se usa la media de RED, que coincide con la del libro en los 10 roles (comprobado).
  - La «mano con herramientas» del técnico es una opción de ciberbrazo sin ciberbrazo en el libro: si una opción no tiene fundacional de su tipo, se instala en la ficha y se avisa en el resumen del chat.

### 2026-11-08 — Paso 4: Edgerunner (0.3.0) — Claude Code

- **Hecho:**
  - `logic/methods.js` (`missingFor`, `planFor`, `edgerunnerStats`, `edgerunnerSkills`, `skillCost`);
  - paso Características con 10 huecos de tirada, uno por característica, y la celda elegida marcada en la tabla;
  - paso Habilidades con un campo de nivel por habilidad, columna de coste, contador de puntos (en rojo si se pasa) y especialidades e idioma;
  - revisión y aplicación comunes a ambos métodos (`buildPlan` usa `planFor`);
  - título «Amigos» en la vida pasada (la tabla heredaba el encabezado de página «Amigos y enemigos»).
- **Pruebas:**
  - unitarias 20/20 (`tests/edgerunner.test.mjs`: costes, ejemplo real de Jay = 86, mínimos, exceso de presupuesto, fuera de rango, características por columna, plan);
  - banco 30013 (`tools/bench/gen04-edgerunner.mjs`), con un mercenario:
    - 10 tiradas en el chat, con la fila igual a la tirada − 1;
    - reparto de Jay → «86 de 86»;
    - 88 puntos → contador en rojo y revisión bloqueada;
    - un 9 se recorta a 6;
    - vida pasada 24/24 y 2 elecciones de equipo;
    - aplicación: características por columna, Disparo automático 2, Evasión 6, Tácticas 4, idioma, rol con rango 4, ciberequipo instalado, Humanidad 60 − 14 = 46 (EMP 4, como en el libro) y 500 ed;
    - 0 errores.
  - Regresión de Rata callejera (`gen03`) correcta.
  - Capturas revisadas. Tras compactar las filas de la tabla de habilidades, que eran demasiado altas, se comprobó con una captura nueva.
- **Incidencia de entorno:** una copia al banco falló por un corte de SSH (timeout). Se repitió y se comprobó el archivo servido por Foundry. El puerto 30013 quedó con una escucha sin proceso propietario (residuo del sistema tras cerrar el túnel): comprobado que no hay ningún ssh propio. Hay otro túnel ajeno (31420→30014), que no se tocó.

## Cómo retomar

1. Lee este documento y `module.json`.
2. Ejecuta las pruebas unitarias y, si cambias el extractor, vuelve a generar los datos.
3. Siguiente: **paso 5, Paquete completo con tienda.**
   - **Características:** reparto de puntos según el rango (`rules.complete.statPoints`; el principiante tiene 62, y el DJ podría elegir otro rango con un ajuste nuevo), cada una entre 2 y 8. Usa `stats.<clave>` → `{value}` (no `{row}`): hay que distinguirlo en `planFor`.
   - **Habilidades:** 86 puntos entre **cualquiera** de las 66 (`skills.json`), máximo 6. Las 13 básicas tienen mínimo 2 (`basic` en `skills.json`, más «Idioma (jerga callejera)» y «Experto local (tu hogar)»); el resto empieza en 0. Coste: el de `skillCost`. Las especialidades (Artes marciales, Ciencia, Tocar instrumento) se añaden eligiendo el Item del compendio, cada una con su nivel. Idioma de origen gratis, a 4.
   - **Tienda:** 2550 ed para armas, blindaje, equipo y ciberequipo, y 800 ed solo para moda y cibermoda (lo que no se gasta de los 800 se pierde; lo de los 2550 se conserva como dinero). Precios: `system.price.market` de los Items de los compendios de RED (`core_weapons`, `core_armor`, `core_gear`, `core_ammo`, `core_cyberware`, `core_clothing`, `core_programs`). En el libro la ropa es «moda»; la cibermoda es el ciberequipo de tipo `fashionware`. Conviene un buscador por compendio, un carrito con cantidades y los totales de ambos presupuestos.
   - **Aplicación:** el dinero sobrante de los 2550 va a `system.wealth`; no hay los 500 ed extra (`rules.extraMoney` solo es para Rata callejera y Edgerunner).
   - Pruebas: lógica pura de presupuestos y validación, y prueba de banco copiando `gen04-edgerunner.mjs`.
4. No escribas en `edgerunners-2070` ni en ESTADO/PRUEBAS sin confirmar con el director que Codex ha terminado.
