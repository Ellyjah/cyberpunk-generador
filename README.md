# Cyberpunk RED — Generador de personajes (`cyberpunk-generador`)

Asistente para **Foundry VTT 12** y **Cyberpunk RED – Core** que crea personajes jugadores y PNJ con los métodos del libro básico. Las tiradas salen en el chat y el resultado se aplica a una ficha.

*Contenido no oficial, no aprobado ni respaldado por R. Talsorian Games.*

## Qué hace

**Personajes jugadores**, con los tres métodos del libro:
- **Rata callejera:** plantilla por rol.
- **Edgerunner:** plantilla con elecciones.
- **Paquete completo:** puntos de característica y de habilidad, especialidades y tienda con buscador, carrito y presupuestos. El rango se configura.

En los tres, además:
- **Vida pasada completa**, tirando en el chat o eligiendo.
- **Revisión final:** nada se escribe en la ficha hasta el último paso, que lo aplica todo de una vez.
- **Volver a aplicar:** sustituye la aplicación anterior, sin duplicar características ni habilidades, y necesita la autorización del DJ.

**PNJ**
- Fichas del libro básico a partir de sus plantillas.
- PNJ rápido por rol, con vida pasada opcional.
- Encuentro aleatorio (1d100, solo para el DJ), con creación de las fichas que usa.
- Sirve tanto para personajes como para secuaces de RED.

**Permisos y tiradas**
- El DJ lo abre desde el directorio de actores o desde la cabecera de cualquier ficha.
- Los jugadores solo pueden usarlo en las fichas de las que el DJ les haya dado la propiedad, y si el ajuste «Autorizar a los jugadores» está activo. Al desactivarlo, su botón desaparece al momento.
- «Tiradas del generador»: el DJ decide cómo se hacen las tiradas.

**Partida de Edgerunners** (ajuste opcional)
- Sustituye la tienda de RED por la del Mission Kit, junto con los objetos de RED válidos a precio 2070 (el doble).
- Da gratis el neuropuerto de creación si el personaje lleva ciberequipo.

## Dependencias

| Tipo | Paquete | Versión |
|---|---|---|
| Plataforma | Foundry VTT | 12 (verificado 12.343) |
| Sistema | Cyberpunk RED – Core (`cyberpunk-red-core`) | verificado v0.92.4 |
| Módulos obligatorios | ninguno | — |

**Se integra con (opcionales):**
- `edgerunners-2070` y `edgerunners-mission-kit`: los dos juntos activan el ajuste «Partida de Edgerunners».
- `cyberpunk-tr-esp`: los objetos de RED salen en castellano.

**Lo necesitan:** ningún módulo.

## Instalación

En Foundry, «Instalar módulo» → «URL del manifiesto»:

```
https://github.com/Ellyjah/cyberpunk-generador/releases/latest/download/module.json
```

**Uso:** botón «Generador de personajes» en el directorio de actores, o «Generador» en la cabecera de una ficha.

Estado técnico, decisiones y pruebas: [DESARROLLO.md](DESARROLLO.md).
