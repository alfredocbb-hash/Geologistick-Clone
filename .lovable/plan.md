
# Actualizar zona_destino de la tarifa "ENVIOS GENERAL" - BlackBox Cargas

## Situación actual

- Tarifa: **ENVIOS GENERAL** (`8811dfc7-6047-438b-805d-9c16d3b8fde7`)
- Tipo: `zona`
- `zona_destino`: vacío (null)
- Tenant: BlackBox Cargas (`81be07a7-73a0-4986-994e-5365478343eb`)

## Qué se va a hacer

Se ejecuta un único UPDATE en la tabla `tarifas` para completar el campo `zona_destino` con todas las localidades de la imagen, separadas por coma. Esto activa inmediatamente la auto-selección de tarifa en el formulario de nuevo envío para BlackBox.

## SQL a ejecutar

```sql
UPDATE tarifas
SET zona_destino = 'Vicente López,Florida,Olivos,Nuñez,Saavedra,Coghlan,Belgrano,Villa Urquiza,Palermo,Colegiales,Villa Ortuzar,Parque Chas,Chacarita,Recoleta,Retiro,Villa Pueyrredón,Agronomía,Villa Devoto,Villa del Parque,La Paternal,Villa Crespo,Villa Real,Monte Castro,Villa Santa Rita,Villa General Mitre,Caballito,Almagro,Balvanera,San Nicolás,Puerto Madero,Monserrat,La Boca,San Telmo,Constitución,Barracas,Parque Patricios,San Cristóbal,Boedo,Parque Chacabuco,Nueva Pompeya,Flores,Floresta,Velez Sarfield,Villa Luro,Versalles,Liniers,Mataderos,Paternal,Parque Avellaneda,Villa Soldati,Villa Lugano,Villa Riachuelo,CABA,Capital Federal,Martinez,La Lucila,Munro,Carapachay,Villa Martelli,Villa Adelina,Boulogne,Acassuso,San Isidro,Beccar,Victoria,Virreyes,San Fernando,Tigre,Troncos del Talar,General Pacheco,Ricardo Rojas,El Talar,Don Torcuato,Rincón de Milberg,Benavidez,Villa Maipú,San Martin,Villa Lynch,San Andrés,Villa Ballester,Billinghurst,José León Suárez,Loma Hermosa,Grand Bourg,Pablo Nogues,Los Polvorines,Villa de Mayo,Ingeniero Adolfo Sourdeaux,Del Viso,Belén de Escobar,Garin,Ingeniero Maschwitz,Matheu,Maquinista F. Savio,Pilar,Presidente Derqui,Villa Rosa,Remedios de Escalada,Dock Sud,Avellaneda,Piñeyro,Gerli,Sarandí,Villa Dominico,Wilde,Valentín Alsina,Lanús Oeste,Lanús,Monte Chingolo,La Noria,Banfield,Lomas de Zamora,Temperley,Turdera,Lavallol,Don Bosco,Bernal Oeste,Bernal,Quilmes,Quilmes Oeste,Ezpeleta,Ezpeleta Oeste,San Francisco Solano,San José,José Mármol,Rafael Calzada,Claypole,Adrogué,Burzaco,Malvinas Argentinas,Don Orione,Longchamps,Glew,Ministro Rivadavia,Luis Guillon,Monte Grande,El Jagüel,José María Ezeiza,La Unión,Tristán Suárez,Canning,Carlos Spegazzini,Berazategui,Berazategui Oeste,Villa España,Sourigues,Ranelagh,Platanos,Guillermo Hudson,Juan María Gutierrez,El Pato,Pereyra,Florencio Varela,Gobernador Costa,Zeballos,Villa Vatteone,Bosques,Villa San Luis,Villa Brown,Ingeniero Allan,La Capilla,Brandsen,Domnselaar,Cañuelas,La Plata,Guernica,Alejandro Korn,San Vicente,Tortuguitas,Aldo Bonzi,Bella Vista,Caseros,Castelar,Churruca,Ciudad Jardín Lomas del Palomar,Ciudadela,El Libertador,El Palomar,González Catán,Gregorio de Laferrere,Haedo,Hurlingham,Morón,Isidro Casanova,Ituzaingo,José C. Paz,José Ingenieros,La Tablada,Lomas del Mirador,Martin Coronado,Merlo,Moreno,Muñiz,Once de Septiembre,Pablo Podestá,Rafael Castillo,Ramos Mejía,Saenz Peña,San Justo,San Miguel,Santos Lugares,Tapiales,Villa Bosch,Villa Luzuriaga,Villa Madero,Villa Raffo,Villa Sarmiento,Villa Tesei,Buenos Aires,GBA,Gran Buenos Aires'
WHERE id = '8811dfc7-6047-438b-805d-9c16d3b8fde7'
  AND tenant_id = '81be07a7-73a0-4986-994e-5365478343eb';
```

## Detalle de localidades incluidas (extraídas de la imagen)

- **CABA** (54 barrios): Vicente López, Florida, Olivos, Nuñez, Saavedra, Coghlan, Belgrano, Villa Urquiza, Palermo, Colegiales, Villa Ortuzar, Parque Chas, Chacarita, Recoleta, Retiro, Villa Pueyrredón, Agronomía, Villa Devoto, Villa del Parque, La Paternal, Villa Crespo, Villa Real, Monte Castro, Villa Santa Rita, Villa General Mitre, Caballito, Almagro, Balvanera, San Nicolás, Puerto Madero, Monserrat, La Boca, San Telmo, Constitución, Barracas, Parque Patricios, San Cristóbal, Boedo, Parque Chacabuco, Nueva Pompeya, Flores, Floresta, Velez Sarfield, Villa Luro, Versalles, Liniers, Mataderos, Paternal, Parque Avellaneda, Villa Soldati, Villa Lugano, Villa Riachuelo
- **Zona Norte** (42 localidades): Martinez, La Lucila, Munro, Carapachay, Villa Martelli, Villa Adelina, Boulogne, Acassuso, San Isidro, Beccar, Victoria, Virreyes, San Fernando, Tigre, Troncos del Talar, General Pacheco, Ricardo Rojas, El Talar, Don Torcuato, Rincón de Milberg, Benavidez, Villa Maipú, San Martin, Villa Lynch, San Andrés, Villa Ballester, Billinghurst, José León Suárez, Loma Hermosa, Grand Bourg, Pablo Nogues, Los Polvorines, Villa de Mayo, Ingeniero Adolfo Sourdeaux, Del Viso, Belén de Escobar, Garin, Ingeniero Maschwitz, Matheu, Maquinista F. Savio, Pilar, Presidente Derqui, Villa Rosa
- **Zona Sur** (55 localidades): Remedios de Escalada, Dock Sud, Avellaneda, Piñeyro, Gerli, Sarandí, Villa Dominico, Wilde, Valentín Alsina, Lanús Oeste, Lanús, Monte Chingolo, La Noria, Banfield, Lomas de Zamora, Temperley, Turdera, Lavallol, Don Bosco, Bernal Oeste, Bernal, Quilmes, Quilmes Oeste, Ezpeleta, Ezpeleta Oeste, San Francisco Solano, San José, José Mármol, Rafael Calzada, Claypole, Adrogué, Burzaco, Malvinas Argentinas, Don Orione, Longchamps, Glew, Ministro Rivadavia, Luis Guillon, Monte Grande, El Jagüel, José María Ezeiza, La Unión, Tristán Suárez, Canning, Carlos Spegazzini, Berazategui, Berazategui Oeste, Villa España, Sourigues, Ranelagh, Platanos, Guillermo Hudson, Juan María Gutierrez, El Pato, Pereyra, Florencio Varela, Gobernador Costa, Zeballos, Villa Vatteone, Bosques, Villa San Luis, Villa Brown, Ingeniero Allan, La Capilla, Brandsen, Domnselaar, Cañuelas, La Plata, Guernica, Alejandro Korn, San Vicente
- **Zona Oeste** (42 localidades): Tortuguitas, Aldo Bonzi, Bella Vista, Caseros, Castelar, Churruca, Ciudad Jardín Lomas del Palomar, Ciudadela, El Libertador, El Palomar, González Catán, Gregorio de Laferrere, Haedo, Hurlingham, Morón, Isidro Casanova, Ituzaingo, José C. Paz, José Ingenieros, La Tablada, Lomas del Mirador, Martin Coronado, Merlo, Moreno, Muñiz, Once de Septiembre, Pablo Podestá, Rafael Castillo, Ramos Mejía, Saenz Peña, San Justo, San Miguel, Santos Lugares, Tapiales, Villa Bosch, Villa Luzuriaga, Villa Madero, Villa Raffo, Villa Sarmiento, Villa Tesei

Se incluyen también los alias genéricos `CABA`, `Capital Federal`, `Buenos Aires`, `GBA` y `Gran Buenos Aires` para mayor cobertura de búsqueda.

## Efecto inmediato

Una vez ejecutado el SQL, cuando un operador de BlackBox ingrese cualquiera de esas localidades en el campo "Ciudad del destinatario", el sistema detectará automáticamente la tarifa "ENVIOS GENERAL" y calculará el flete por peso o m3 según corresponda.

## Archivo a modificar

Solo base de datos - no hay cambios de código necesarios.
