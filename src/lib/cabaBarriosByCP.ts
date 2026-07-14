/**
 * Mapa de códigos postales de CABA a barrio.
 * Basado en referencias públicas del Correo Argentino / Gobierno CABA.
 * Cuando Google devuelve "Buenos Aires" como localidad, usamos esta tabla
 * para inferir el barrio a partir del CP (4 dígitos o CPA "C" + 4).
 */

export const CABA_BARRIO_BY_CP: Record<string, string> = {
  // San Nicolás / Microcentro
  "1001": "San Nicolás", "1002": "San Nicolás", "1003": "San Nicolás",
  "1004": "San Nicolás", "1005": "San Nicolás", "1006": "San Nicolás",
  "1007": "San Nicolás", "1008": "San Nicolás", "1009": "San Nicolás",
  "1010": "Retiro", "1011": "Retiro", "1012": "Retiro",
  "1013": "Retiro", "1014": "Retiro", "1015": "Retiro", "1016": "Retiro",
  "1017": "Recoleta", "1018": "Recoleta", "1019": "Recoleta",
  "1020": "San Nicolás", "1021": "San Nicolás", "1022": "San Nicolás",
  "1023": "San Nicolás", "1024": "San Nicolás", "1025": "San Nicolás",
  "1026": "San Nicolás",
  "1027": "Balvanera", "1028": "Balvanera", "1029": "Balvanera",
  "1030": "Balvanera", "1031": "Balvanera", "1032": "Balvanera",
  "1033": "Balvanera", "1034": "Balvanera", "1035": "Balvanera",
  "1036": "Balvanera", "1037": "Balvanera", "1038": "Balvanera",
  "1039": "Balvanera",
  "1040": "Monserrat", "1041": "Monserrat", "1042": "Monserrat",
  "1043": "Monserrat", "1044": "Monserrat", "1045": "Monserrat",
  "1046": "Monserrat", "1047": "Monserrat", "1048": "Monserrat",
  "1049": "Monserrat",
  "1050": "Retiro", "1051": "Retiro", "1052": "Retiro",
  "1053": "Retiro", "1054": "Retiro", "1055": "Retiro",
  "1056": "Retiro", "1057": "Retiro", "1058": "Retiro", "1059": "Retiro",
  "1060": "Monserrat", "1061": "Monserrat", "1062": "Monserrat",
  "1063": "Monserrat", "1064": "Monserrat", "1065": "Monserrat",
  "1066": "Monserrat", "1067": "Monserrat", "1068": "Monserrat",
  "1069": "Monserrat", "1070": "Constitución",
  "1071": "Constitución", "1072": "Constitución", "1073": "Constitución",
  "1074": "Constitución", "1075": "Constitución",
  "1076": "Balvanera", "1077": "Balvanera", "1078": "Balvanera",
  "1079": "Balvanera", "1080": "Balvanera", "1081": "Balvanera",
  "1082": "Balvanera", "1083": "Balvanera", "1084": "Balvanera",
  "1085": "Balvanera", "1086": "Balvanera", "1087": "Balvanera",
  "1088": "Balvanera", "1089": "Balvanera", "1090": "Balvanera",
  "1091": "Balvanera", "1092": "Balvanera", "1093": "Balvanera",
  "1094": "Balvanera", "1095": "Balvanera", "1096": "Balvanera",
  "1097": "Balvanera", "1098": "Balvanera", "1099": "Balvanera",
  // Puerto Madero / Retiro
  "1100": "Retiro", "1101": "Retiro", "1102": "Retiro",
  "1103": "Retiro", "1104": "Retiro", "1105": "Retiro",
  "1106": "Retiro", "1107": "Puerto Madero", "1108": "Puerto Madero",
  "1109": "Puerto Madero",
  // Recoleta
  "1110": "Recoleta", "1111": "Recoleta", "1112": "Recoleta",
  "1113": "Recoleta", "1114": "Recoleta", "1115": "Recoleta",
  "1116": "Recoleta", "1117": "Recoleta", "1118": "Recoleta",
  "1119": "Recoleta", "1120": "Recoleta", "1121": "Recoleta",
  "1122": "Recoleta", "1123": "Recoleta", "1124": "Recoleta",
  "1125": "Recoleta", "1126": "Recoleta", "1127": "Recoleta",
  "1128": "Recoleta", "1129": "Recoleta",
  "1178": "Balvanera", "1179": "Balvanera",
  "1180": "Balvanera", "1181": "Balvanera", "1182": "Balvanera",
  "1183": "Balvanera", "1184": "Balvanera", "1185": "Balvanera",
  "1186": "Balvanera", "1187": "Balvanera", "1188": "Recoleta",
  "1189": "Recoleta", "1190": "Recoleta", "1191": "Recoleta",
  "1192": "Recoleta", "1193": "Recoleta", "1194": "Recoleta",
  "1195": "Recoleta", "1196": "Recoleta", "1197": "Recoleta",
  "1198": "Recoleta", "1199": "Recoleta",
  // Almagro / Balvanera / San Cristóbal / Boedo
  "1200": "Balvanera", "1201": "Balvanera", "1202": "Balvanera",
  "1203": "Balvanera", "1204": "Balvanera", "1205": "Balvanera",
  "1206": "Balvanera", "1207": "Balvanera", "1208": "Balvanera",
  "1209": "Balvanera",
  "1210": "Almagro", "1211": "Almagro", "1212": "Almagro",
  "1213": "Almagro", "1214": "Almagro", "1215": "Almagro",
  "1216": "Almagro", "1217": "Almagro", "1218": "Almagro",
  "1219": "Almagro", "1220": "Almagro", "1221": "Almagro",
  "1222": "Almagro", "1223": "Almagro", "1224": "Almagro",
  "1225": "Almagro",
  "1226": "San Cristóbal", "1227": "San Cristóbal", "1228": "San Cristóbal",
  "1229": "San Cristóbal", "1230": "San Cristóbal", "1231": "San Cristóbal",
  "1232": "San Cristóbal", "1233": "San Cristóbal", "1234": "San Cristóbal",
  "1235": "San Cristóbal", "1236": "San Cristóbal", "1237": "San Cristóbal",
  "1238": "San Cristóbal", "1239": "San Cristóbal",
  "1240": "Boedo", "1241": "Boedo", "1242": "Boedo",
  "1243": "Boedo", "1244": "Boedo", "1245": "Boedo",
  "1246": "Boedo", "1247": "Boedo", "1248": "Boedo", "1249": "Boedo",
  // Parque Patricios / Barracas / La Boca
  "1250": "Parque Patricios", "1251": "Parque Patricios",
  "1252": "Parque Patricios", "1253": "Parque Patricios",
  "1254": "Parque Patricios", "1255": "Parque Patricios",
  "1256": "Parque Patricios", "1257": "Parque Patricios",
  "1258": "Parque Patricios", "1259": "Parque Patricios",
  "1260": "Barracas", "1261": "Barracas", "1262": "Barracas",
  "1263": "Barracas", "1264": "Barracas", "1265": "Barracas",
  "1266": "Barracas", "1267": "Barracas", "1268": "Barracas",
  "1269": "Barracas", "1270": "Barracas", "1271": "Barracas",
  "1272": "Barracas",
  "1273": "La Boca", "1274": "La Boca", "1275": "La Boca",
  "1276": "La Boca", "1277": "La Boca", "1278": "La Boca",
  "1279": "La Boca", "1280": "La Boca", "1281": "La Boca",
  "1282": "La Boca", "1283": "La Boca", "1284": "La Boca",
  "1285": "La Boca", "1286": "La Boca", "1287": "La Boca",
  "1288": "La Boca",
  "1290": "Puerto Madero", "1291": "Puerto Madero", "1292": "Puerto Madero",
  "1293": "Puerto Madero", "1294": "Puerto Madero", "1295": "Puerto Madero",
  "1296": "Puerto Madero", "1297": "Puerto Madero", "1298": "Puerto Madero",
  "1299": "Puerto Madero",
  // Zona sur / Villa Soldati / Nueva Pompeya / Flores / Parque Chacabuco
  "1424": "Parque Chacabuco",
  "1437": "Nueva Pompeya", "1438": "Villa Soldati",
  // Palermo / Villa Crespo / Almagro / Caballito
  "1405": "Caballito", "1406": "Caballito", "1407": "Flores",
  "1408": "Villa Luro", "1409": "Vélez Sarsfield",
  "1414": "Villa Crespo", "1415": "Villa Crespo", "1416": "Villa Crespo",
  "1425": "Palermo", "1426": "Palermo", "1427": "Colegiales",
  "1428": "Belgrano", "1429": "Núñez", "1430": "Belgrano",
  "1431": "Núñez",
  // Chacarita / Paternal / Villa Ortúzar / Villa Urquiza / Coghlan
  "1427C": "Colegiales",
  "1416C": "Villa Crespo",
  "1414C": "Villa Crespo",
  "1417": "Villa del Parque", "1418": "Villa Devoto",
  "1419": "Villa Pueyrredón",
  "1420": "Villa Real", "1440": "Mataderos",
  "1439": "Liniers",
  "1432": "Villa Urquiza", "1431A": "Núñez",
  "1430A": "Belgrano", "1428A": "Belgrano",
  "1435": "Villa Urquiza", "1431B": "Núñez",
  "1430B": "Belgrano",
  // Flores / Floresta / Parque Avellaneda / Vélez Sarsfield / Villa Lugano / Villa Riachuelo
  "1406C": "Caballito",
  "1407C": "Flores",
  "1407A": "Floresta",
  "1408A": "Villa Luro",
  "1408B": "Vélez Sarsfield",
  "1439A": "Parque Avellaneda",
  "1439B": "Liniers",
  "1440A": "Mataderos",
  "1439C": "Villa Lugano",
  "1439D": "Villa Riachuelo",
  // Agronomía / La Paternal / Chacarita / Villa Ortúzar
  "1416A": "La Paternal",
  "1416B": "Agronomía",
  "1414A": "Chacarita",
  "1414B": "Villa Ortúzar",
  // Coghlan / Saavedra / Villa Urquiza
  "1430C": "Coghlan",
  "1430D": "Saavedra",
  "1431C": "Saavedra",
  "1431D": "Villa Urquiza",
  "1432A": "Villa Urquiza",
  "1419A": "Villa Pueyrredón",
  "1419B": "Villa Devoto",
  "1417A": "Villa del Parque",
  "1417B": "Villa General Mitre",
  "1417C": "Villa Santa Rita",
};

/**
 * Normaliza un código postal: extrae 4 dígitos, quita prefijo "C" y sufijos alfabéticos.
 */
function normalizeCP(cp: string | null | undefined): string | null {
  if (!cp) return null;
  const clean = cp.trim().toUpperCase();
  // Formato CPA: C1425DBI -> extraer 1425
  const cpaMatch = clean.match(/^C?(\d{4})([A-Z]{0,3})$/);
  if (cpaMatch) {
    const digits = cpaMatch[1];
    const suffix = cpaMatch[2] || "";
    // Probar clave con primer carácter del sufijo (más específico)
    if (suffix && CABA_BARRIO_BY_CP[digits + suffix[0]]) {
      return digits + suffix[0];
    }
    return digits;
  }
  // Solo dígitos
  const digitsOnly = clean.replace(/\D/g, "");
  if (digitsOnly.length >= 4) return digitsOnly.slice(0, 4);
  return null;
}

/**
 * Devuelve el barrio de CABA para un CP dado, o null si no está mapeado.
 */
export function getBarrioByCP(cp: string | null | undefined): string | null {
  const key = normalizeCP(cp);
  if (!key) return null;
  return CABA_BARRIO_BY_CP[key] ?? null;
}

/**
 * Indica si un CP pertenece a CABA (rango 1000-1499 en 4 dígitos).
 */
export function isCabaCP(cp: string | null | undefined): boolean {
  const key = normalizeCP(cp);
  if (!key) return false;
  const num = parseInt(key.slice(0, 4), 10);
  return num >= 1000 && num <= 1499;
}

/**
 * Nombres genéricos que indican "CABA" a nivel ciudad, pero que deberían ser reemplazados por el barrio.
 */
export function isGenericCabaCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const norm = city.trim().toLowerCase();
  return (
    norm === "buenos aires" ||
    norm === "caba" ||
    norm === "capital federal" ||
    norm === "ciudad autónoma de buenos aires" ||
    norm === "ciudad autonoma de buenos aires" ||
    norm.startsWith("ciudad aut")
  );
}
