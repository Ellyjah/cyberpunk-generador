# cyberpunk-generador: desarrollo y traspaso

Documento vivo del generador de personajes. Está escrito para que **Codex (o cualquier agente) pueda continuar el trabajo** si Claude Code se queda sin cuota. Al terminar cada paso, actualiza la bitácora y la sección «Cómo retomar».

## Encargo y decisiones del director (2026-11-08)

El director pidió un generador lo más completo posible para PJ y PNJ. Debe cubrir los tres métodos de creación de Cyberpunk RED e incluir botones para que jugadores y DJ hagan las tiradas. Antes de escribir código se le consultó, y decidió lo siguiente:

| Tema | Decisión |
|---|---|
| Ubicación | Módulo nuevo e independiente, con id **`cyberpunk-generador`** (sin sufijo). No va dentro de `edgerunners-2070`. |
| Dependencias | **Solo el sistema `cyberpunk-red-core`** (indicación del director, 2026-11-08): debe funcionar sin ninguno de los demás módulos del proyecto (Babele, `cyberpunk-tr-esp`, Core en español, motor, Mission Kit). Las tablas van dentro del módulo, en `data/`. Para una partida de Edgerunners tiene sentido que pida y use el motor 2070 y el Mission Kit (sobre todo por sus objetos de inventario); esa integración es el paso 7 y solo se activa si esos módulos están presentes. |
| Autorización de jugadores | Ajuste «Autorizar a los jugadores a usar el generador», **desactivado por defecto**. El DJ lo activa durante la creación y lo cierra al terminar. Al cerrarlo, el botón desaparece al momento de la interfaz de los jugadores y se cierran sus generadores (indicación del director, 2026-11-08). |
| Segunda aplicación | Requiere la autorización del DJ en una ventana: si la pide un jugador, el DJ la autoriza y se ejecuta desde su cliente; si la pide el DJ, la confirma en la misma ventana. **Sustituye** a la anterior, no se suma (indicación del director, 2026-11-08). |
| PNJ | Dos vías: las plantillas de amenaza del libro (secuaces, lugartenientes, minijefes y jefes) con variaciones, y la generación rápida por rol con el método Rata callejera. |
| Quién crea los PJ | El DJ y los jugadores. Un jugador **solo trabaja sobre una ficha existente** de la que el DJ le haya dado la propiedad, y los cambios van a esa ficha. Los jugadores nunca crean actores. |
| Tiradas | Un ajuste del DJ elige entre «Tirar o elegir» y «Solo tiradas». Todas las tiradas salen en el chat, y el DJ puede autorizar que se repita una. |
| Partida de Edgerunners (paso 7, 2026-11-08) | Ajuste «Partida de Edgerunners», desactivado por defecto. Solo actúa si están activos `edgerunners-2070` y `edgerunners-mission-kit`; si falta alguno, avisa al DJ y el generador funciona como RED. **Tienda:** el arsenal del Mission Kit (`edgerunners-mission-kit.objetos`, 47 objetos) con su precio y **todos** los objetos de RED **al doble** (el director eligió «todo de RED al doble»; el libro solo da el recargo corporativo ×2 por compra directa). **Neuropuerto:** automático y gratis si hay ciberequipo que no sea de grado médico, con pérdida media en el resto de implantes. Las listas de equipo inicial del libro no cambian. |
| Equipo | Edgerunner usa las listas del libro por rol. Paquete completo usa una tienda con los compendios de RED, que salen en español gracias a `cyberpunk-tr-esp`, con control de presupuesto y límites. |
| Vida pasada | Completa: la general más la propia de cada uno de los 10 roles, escrita en los campos `system.lifepath.*` de la ficha de RED. |

**Naturaleza del módulo:** las tablas del libro (vida pasada, plantillas de rata callejera, listas de equipo, PNJ) son contenido comercial. Por eso este es un **módulo privado de contenido**, igual que `cyberpunk-red-core-esp`. No se publica en ningún repositorio público. El repositorio de GitHub, si el director lo autoriza, será privado. No aplica la regla del motor de no llevar contenido, que es solo para `edgerunners-2070`.

## Plan por pasos

1. **Esqueleto, permisos y ajustes.** ✅ 0.1.0.
2. **Tablas de PJ en datos** (`data/*.json`), extraídas del Core en español y cotejadas. ✅ (las tablas de PNJ se extraen en el paso 6).
3. **Rata callejera y vida pasada** (tiradas en el chat, política de tiradas, repetición autorizada, aplicación a la ficha). ✅ 0.2.0.
4. **Edgerunner** (una tirada por característica, 86 puntos de habilidad, mismo equipo que Rata callejera). ✅ 0.3.0.
5. **Paquete completo con tienda**, más sustitución autorizada de la segunda aplicación, autorización de jugadores con efecto inmediato y prueba con solo RED. ✅ 0.4.0.
6. **PNJ**: fichas del libro, encuentros aleatorios y PNJ rápido por rol. ✅ 0.5.0.
7. **Partida de Edgerunners** (tienda Mission Kit + RED al doble, neuropuerto de creación). ✅ 0.6.0.
8. Pruebas completas y copias habituales (proyecto, Raspberry, V12 con el mundo cerrado, GitHub privado; esto último, previa autorización).

## Arquitectura (estado actual)

```
06-cyberpunk-generador/
  module.json            id cyberpunk-generador, Foundry V12 (12.343), sistema cyberpunk-red-core v0.92.4, socket
  scripts/main.js        hooks: init (ajustes y API), ready (socket), botón de cabecera de ficha, botón del directorio (DJ)
  scripts/settings.js    ajustes de mundo: playersEnabled (Boolean, por defecto false; efecto inmediato), rollPolicy ("free" | "rollsOnly"),
                         completeRank (puntos de característica del Paquete completo: 50/62/70/75/80, por defecto 62)
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
  scripts/logic/npcs.js      PNJ: npcPlan (ficha del libro), encounterFor, autoAnswers (PNJ rápido)
  scripts/npc.js         menú del botón del directorio (DJ), createActor, createBookNpc, encuentro aleatorio, createQuickNpc
  tools/extract_npcs.py  genera data/npcs.json y data/encounters.json desde el PDF del libro básico (paso 6)
  (settings.js)          edgerunnersMode(), missingEdgerunnersModules(), warnEdgerunners() (paso 7)
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

**Paquete completo** (`logic/methods.js`: `completeStats`, `completeSkills`, `shopTotals`):
- Características: `stats.<clave>` → `{value}`. Por defecto valen 6 (el «reparto inicial» del Core, 60 puntos). Cada una entre 2 y 8, con los puntos del ajuste `completeRank`.
- Habilidades: `skill.<nombre de skills.json>` → `{level}` para las 66. Las 13 básicas (`basic`), mínimo 2; el resto, 0. Máximo 6, 86 puntos y el coste de `skillCost`. Especialidades: `spec.<Artes marciales|Ciencia|Tocar instrumento>` → `{uuid, text}`, obligatoria si el nivel es mayor que 0. Hay una especialidad por habilidad; varias especialidades de la misma habilidad, como Ciencia (Física) y Ciencia (Química), no están contempladas.
- Tienda: `cart` → `{items: [{uuid, name, price, amount, packs, type, fashion}]}`.
  - Compendios: `SHOP_PACKS` de `wizard.js` (armas, blindaje, munición, equipo, programas, ciberequipo, moda). No incluye armas de marca, mejoras, drogas ni vehículos.
  - Precio por caja = `system.price.market`; unidades por caja = `system.amount` (munición, 10). Comprobado: la compra de Jay del Core, con los precios de RED, da 2550 ed exactos.
  - Moda = `clothing`, más `cyberware` de tipo `fashionware`. Se paga primero de los 800 ed y el exceso, de los 2550. Lo que sobra de los 2550 pasa a `system.wealth`; lo que sobra de los 800 se pierde.
  - No hay los 500 ed extra.
- Revisión: bloquea si se pasan los puntos de características o de habilidades, si falta una especialidad o si se pasa el presupuesto.

**Sustitución de una aplicación anterior** (`apply.js`: `applyCharacter`, `undoApplied`, `appliedRecord`):
- Cada Item creado lleva `flags.cyberpunk-generador.generated`. La ficha guarda `flags.cyberpunk-generador.applied` (texto JSON `{at, by, method, money, coreSkills, replaced}`), que se conserva aunque el DJ reinicie el borrador.
- Al reaplicar, primero se deshace la aplicación anterior:
  - el ciberequipo generado se desinstala de su contenedor (primero las opciones, después los fundacionales) y se borran los Items generados;
  - se limpian las referencias huérfanas en las listas de instalación;
  - las habilidades base de `coreSkills` vuelven a 0;
  - se retira `money` con su apunte y se vacía el rol activo.

  Después se aplica normalmente. Los Items que no creó el generador no se tocan.
- Autorización: el jugador con una aplicación previa envía `reapplyRequest` por socket. El DJ activo ve una ventana con el nombre del jugador y, si acepta, ejecuta `applyCharacter` en su cliente, con el registro a nombre del jugador. Si el DJ no acepta, se envía un susurro a ambos. El DJ reaplica confirmando la misma ventana («Autorizar una nueva aplicación»).

**Autorización de jugadores:** `playersEnabled` tiene un `onChange` en cada cliente de jugador (`settings.js`). Al cerrarse, se quitan los botones `.cprgen-open` de las fichas abiertas, se cierran los asistentes y se avisa. Al abrirse, se reabren sus fichas de personaje abiertas para que aparezca el botón.

**PNJ** (paso 6, solo DJ). El botón «Generador de personajes» del directorio abre un menú con cuatro opciones: Personaje jugador, PNJ del libro, Encuentro aleatorio y PNJ rápido por rol. Los PNJ van a la carpeta «Generador: PNJ», como secuaz (`mook`) o personaje completo.
- **Datos** (`tools/extract_npcs.py`, PDF del libro básico):
  - `npcs.json`: las 10 fichas de «Tipejos y reclutas» (PDF 416–420) con nivel de amenaza (`mook`, `lieutenant`, `miniboss`, `boss`, según el texto del libro), características, PD, rol y rango si lo tienen, habilidades (nivel = base del libro − característica), armas, blindaje, equipo y ciberequipo con opciones, y programas.
  - `encounters.json`: las tres tablas de Night City (diurnos, al anochecer y de medianoche; 1d100; PDF 421–429), con el texto de cada entrada y las fichas que usa (`uses`), más `external` para las referencias fuera de las 10 fichas (torreta automatizada).
  - Validaciones: PD = 10 + 5 × ⌈(VOL + TCO) / 2⌉, Gravemente herido = ⌈PD / 2⌉ y Salvación = TCO en las 10 fichas; rangos 1–100 completos; ningún «Usa» sin ficha; sin restos de maquetación ni caracteres de control. Es idempotente.
  - Los nombres de objetos se resuelven con los enlaces del Core en español, los nombres de `cyberpunk-tr-esp` y `ALIAS`, solo al extraer; en ejecución no se depende de esos módulos. Todos quedan resueltos.
- **Orden del texto del PDF** (maquetación en columnas, estable en las 10 fichas): INT, VOL, PD; bases de habilidad; REF, SUE, DES, FRI, Gravemente herido, TEC, TCO, MOV, EMP, Salvación. Los valores «8 (6)» del oficial de seguridad son con y sin Kerenzikov; se toma el primero.
- **Ficha del libro** (`createBookNpc`):
  - características, PD y Humanidad = EMP × 10, sin pérdida al instalar: la EMP del libro ya la tiene en cuenta;
  - habilidades con `applySkills`; «Idioma (nativo)» usa el idioma elegido (por defecto, el español si existe);
  - rol con su rango;
  - armas y blindaje equipados, salvo el ciberequipo de arma (garras, lanzagranadas oculto…) y el blindaje subdérmico, que vienen en el ciberequipo;
  - ciberequipo: cada fundacional con su cantidad y sus opciones repartidas entre ellos (dos ciberbrazos con sus armas ocultas);
  - **corrección final:** si un efecto del ciberequipo cambia una característica (implante de hueso y músculo: +2 TCO), se ajusta el valor base para que el final sea el del libro, que ya lo incluye;
  - las notas indican la ficha de origen, las bases por debajo de la característica (Concentración y Persuasión del ciberpsicópata, por penalizadores que el libro no detalla; nivel 0) y el texto del encuentro si lo hay.
- **Encuentro aleatorio:** se tira 1d100 solo para el DJ, se le envía la entrada por susurro y un diálogo permite crear las fichas que usa la entrada. Las variaciones del texto («sustituye…, añade…, quita…») **se aplican a mano**: están en las notas, porque son texto libre del libro. Un secuaz sirve para varios tokens.
- **PNJ rápido por rol:** Rata callejera con `autoAnswers`: fila, equipo, especialidades, idioma y, opcionalmente, vida pasada al azar con el generador aleatorio de Foundry (`CONFIG.Dice.randomUniform`), sin publicar las tiradas. Se aplica con `applyCharacter` (resumen susurrado al DJ) y, durante la creación, el modo de tirada pasa a «solo DJ» para que las tarjetas de pérdida de Humanidad de RED no sean públicas.
- **Ficha de secuaz de RED:** no tiene vida pasada, estilo de vida ni dinero. `applyPlan` escribe la vida pasada en las notas (`system.information.notes`) y omite el alojamiento y el dinero; `undoApplied` también lo tiene en cuenta.
- **Fallo de RED v0.92.4 que se evita:** `CPRMookActor.create` llama a `super.create` sin `await` ni `return`, así que devuelve `undefined` y el actor aparece después. `createActor` (npc.js) marca el actor con un identificador, espera a su `createActor` y a que RED instale sus ranuras de ciberequipo. Úsalo siempre para crear actores.

**Partida de Edgerunners** (paso 7):
- `edgerunnersMode()` (settings.js) es verdadero solo con el ajuste activado y el motor y el Mission Kit activos. `warnEdgerunners()` avisa al DJ al iniciar y al cambiar el ajuste si faltan módulos.
- Tienda (wizard.js): `shopPacks()` da `[MK_PACK, …RED_SHOP_PACKS]` en este modo, o solo RED fuera de él (ahora con id completo de compendio). `priceFactor(pack)` es ×2 para `cyberpunk-red-core.*` en este modo. El precio se fija en el carrito al añadir el objeto (`price` ya multiplicado y `pack` guardado): si se cambia el ajuste después, los objetos ya en el carrito conservan su precio.
- Neuropuerto (apply.js, paso 5 de `applyPlan`):
  - si en este modo hay algún ciberequipo creado sin las capacidades `neuroport` ni `medical-grade` (ni «grado médico / medical grade» en el nombre), se crea el Item del Mission Kit con la capacidad `neuroport` y `creationFree` (`findCreationNeuroport`, por capacidad; hoy es «Neuropuerto»);
  - se instala en la ficha sin pérdida de Humanidad y se marca con `flags["edgerunners-2070"].install = {mode: "creation", at}`, que es el contrato del motor (`CONTRATOS.md` §2 y §11); el motor devuelve el −2 de Humanidad máxima con `_calcMaxHumanity`;
  - las opciones del mismo tipo (neuralware) se instalan en otro fundacional (la conexión neuronal) antes que en el neuropuerto;
  - si el personaje ya compró un neuropuerto, no se añade otro.
- Fuera de la tienda y del neuropuerto, el modo no cambia nada: las listas de equipo inicial del libro, los PNJ del libro y los encuentros siguen igual. No hay neuropuerto para los PNJ del libro, que son de 2045.

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

### 2026-11-08 — Paso 5: Paquete completo, sustitución autorizada y solo RED (0.4.0) — Claude Code

- **Indicaciones del director durante el paso:**
  1. funcionar con solo RED;
  2. la segunda aplicación, con ventana de autorización del DJ y sustituyendo a la primera;
  3. ajuste para autorizar a los jugadores y bloquearlo al terminar, con desaparición del botón.

  El ajuste del punto 3 ya existía desde 0.1.0; se ha completado con el efecto inmediato, se ha puesto desactivado por defecto y se le ha dado un nombre más claro.
- **Hecho:** Paquete completo (características con puntos, 66 habilidades con especialidades, tienda con buscador por compendio, carrito, cajas y los dos presupuestos), ajuste `completeRank`, sustitución con registro y deshacer, autorización por socket y efecto inmediato del bloqueo.
- **Pruebas:**
  - unitarias 24/24 (`tests/complete.test.mjs`, con los tres ejemplos de Jay del Core: características 62, habilidades 86, compra 2550 ed, más moda 380 de los 800, exceso de moda, exceso de presupuesto y plan);
  - banco 30013 (`tools/bench/gen05-paquete-completo.mjs`):
    - **A)** Jay completo: 62/86, recortes (un 12 queda en 8; una básica a 0 queda en 2), Judo, compra de 1800 ed (sobran 750, que pasan a dinero), munición 10 cajas = 100 balas, ciberequipo instalado y Humanidad 40 − 14 = 26;
    - **B)** reaplicación del DJ con ventana: 1 rol, 10 Items generados (sin duplicados), munición 50, dinero 800 (no 750 + 800);
    - **C)** el jugador pide, el DJ ve la ventana con su nombre, acepta y se aplica (registro `by` = jugador);
    - **D)** al bloquear, el botón y el asistente del jugador desaparecen al momento y llega el aviso; al autorizar, el botón vuelve;
    - **E)** solo RED (Babele, traducción, Core, motor y libWrapper desactivados): Rata callejera completa y aplicada; nombres de RED en inglés y tablas en español. Módulos restaurados y comprobados.
  - 0 errores; capturas revisadas (habilidades, tienda, revisión, solo RED).
- **Fallo de la prueba, no del módulo:** la prenda elegida en la primera ejecución costaba 5000 ed (la primera por orden alfabético), así que la compra se pasaba del presupuesto y el botón de aplicar estaba bloqueado (comportamiento correcto). La prueba elige ahora una prenda de 20 ed.

### 2026-11-08 — Paso 6: PNJ (0.5.0) — Claude Code

- **Decisión del director para el paso 7, anotada en «Cómo retomar»:** ajuste «Partida de Edgerunners», que sustituye la tienda de RED por la de Edgerunners (Mission Kit y objetos de RED válidos, con el precio 2070).
- **Hecho:**
  - extractor y datos de las 10 fichas y de las 3 tablas de encuentros (55 entradas: 52 con ficha y 3 de Trauma Team, que remiten a la pág. 224);
  - `logic/npcs.js` y `npc.js`;
  - menú de cuatro opciones en el directorio;
  - `applySkills`, `itemData` y `withQty` exportados desde `apply.js` para reutilizarlos;
  - `applyCharacter` con la opción `whisper`;
  - `rollToChat` con el modo de tirada.
- **Pruebas:**
  - unitarias 29/29 (`tests/npcs.test.mjs`: reglas de RED en las 10 fichas, plan del guardaespaldas, ciberarmas sin duplicar, tablas 1–100 con fichas válidas, PNJ rápido completo en los 10 roles con y sin vida pasada);
  - banco 30013 (`tools/bench/gen06-pnj.mjs`):
    - las 10 fichas creadas como secuaz: características, PD y niveles correctos; armas y blindaje equipados; ciberequipo instalado con sus opciones (el ciberpsicópata con dos ciberbrazos con armas ocultas y TCO 10); roles Netrunner, Nómada y Mercenario con rango 4; notas;
    - menú con las 4 opciones;
    - encuentro aleatorio desde el menú: tirada y entrada susurradas al DJ y fichas creadas con las notas del encuentro;
    - PNJ rápidos: una netrunner secuaz con la vida pasada en las notas y un mercenario completo con los 17 campos de vida pasada y 500 ed; 0 mensajes públicos;
  - regresión del paso 5 (`gen05`) completa, incluida la prueba con solo RED;
  - 0 errores; capturas revisadas (ficha del ciberpsicópata y menú).
- **Fallos encontrados y corregidos:**
  1. Un `\b` escrito desde la shell se convirtió en el carácter de control 0x08 en el extractor (mismo tipo de incidencia que en el Core 1.0.2). Se corrigió con el editor y ahora el extractor rechaza caracteres de control en los datos. **Para patrones con escapes, usar el editor o un script escrito con el editor, nunca un heredoc de la shell.**
  2. Rangos de encuentros con guion largo, «00» y un solo número; un recuadro lateral y créditos de ilustración dentro de entradas; «Usa» en minúscula o con cantidades («Usa 6 oficiales de seguridad»).
  3. `CPRMookActor.create` de RED no devuelve el actor (ver arriba).
  4. `Roll#evaluateSync` no admite dados en V12.
  5. TCO del ciberpsicópata contado dos veces (efecto del implante más el valor del libro).
  6. La ficha de secuaz no tiene dinero ni vida pasada.
  7. Las tarjetas de pérdida de Humanidad de RED salían públicas al crear PNJ.

### 2026-11-08 — Paso 7: Partida de Edgerunners (0.6.0) — Claude Code

- **Investigación y consulta:**
  - el Libro de reglas del Mission Kit (conversión, PDF 26–27) no da «precios 2070» para los objetos de RED; solo el recargo corporativo ×2 por compra directa, y dice que todo lo de RED sigue valiendo;
  - el Mission Kit 1.4.0 trae 47 objetos nativos con precio en «Arsenal y hackeos rápidos»;
  - consultado el director: todo lo de RED al doble, todos los objetos de RED disponibles y neuropuerto automático.
- **Hecho:**
  - ajuste «Partida de Edgerunners» con comprobación de módulos y aviso;
  - tienda con el Mission Kit y RED ×2;
  - neuropuerto de creación marcado para el motor;
  - avisos en la tienda y en la revisión;
  - rótulo «Catálogo: Mission Kit y RED».
- **Pruebas:**
  - unitarias 29/29 sin cambios;
  - banco 30013 (`tools/bench/gen07-edgerunners.mjs`; el Mission Kit 1.4.0-preview.3 se copió al banco desde V12 con el mundo cerrado, 194/194 archivos idénticos):
    - **A)** sin el modo, 7 compendios de RED y el fusil de asalto a 500;
    - **B)** con el ajuste activado y sin el Mission Kit, aviso «faltan módulos» y tienda de RED;
    - **C)** con el Mission Kit, Mission Kit primero (47 objetos con su precio, neuropuerto a 1000) y fusil a 1000; la compra (Carnage 100 + conexión neuronal 1000 + Sandevistan 1000 = 2100, sobran 450) aplicada da neuropuerto instalado y marcado `creation`, Sandevistan en la conexión neuronal y Humanidad 60 − 14 = 46 con máximo 56 (60 − 3 × 2 + 2 del motor);
    - **D)** una técnica Rata callejera en este modo recibe también su neuropuerto `creation`; Humanidad y máximo coherentes (el −2 del neuropuerto, compensado);
  - regresiones de los pasos 5 (`gen05`, con su prueba actualizada a los id completos de compendio) y 6 (`gen06`): correctas;
  - 0 errores; captura de la tienda revisada.
- **Incidencias de entorno:** la copia del Mission Kit al banco con `cp -a` y `cp -r` falló porque el disco del banco no admite permisos Unix y porque una tubería con `head` cortó la copia (error mío). Se hizo con `tar` y se comparó archivo a archivo. La primera ejecución de la parte B no la probaba de verdad, porque el mundo del banco ya tenía el Mission Kit activado; se corrigió la prueba para desactivarlo primero.

## Cómo retomar

1. Lee este documento y `module.json`.
2. Ejecuta las pruebas unitarias y, si cambias el extractor, vuelve a generar los datos.
3. Siguiente: **paso 8, pruebas completas y copias habituales.**
   - Hay que repetir `tools/bench/gen01` … `gen07` en el banco. El `gen01` usa `Actor.create`; cámbialo a `Actor.implementation.create` si hace falta probar habilidades. El ajuste «Autorizar a los jugadores» está desactivado por defecto: `gen03` lo necesita activado.
   - Revisión visual final del director.
   - Copias: proyecto (`releases/cyberpunk-generador-<v>.zip`, con `git archive` de `module.json`, `scripts`, `templates`, `styles`, `lang` y `data`), carpeta de versiones de la Raspberry, V12 `Data/modules/cyberpunk-generador` (**solo con el mundo cerrado**, comprobando `active:false` en el mismo comando) y GitHub privado (el director lo autorizó para cuando terminen los pasos).
   - Registrar en ESTADO y PRUEBAS cuando el director confirme que Codex ya no escribe en ellos.
5. No escribas en `edgerunners-2070` ni en ESTADO/PRUEBAS sin confirmar con el director que Codex ha terminado.
