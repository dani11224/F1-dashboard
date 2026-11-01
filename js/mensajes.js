// ─────────────────────────────────────────────────────────────
//  MENSAJES PERSONALES
//  Todo lo que dice la página "con tu voz" está aquí.
//  Cámbialos como quieras: solo edita el texto entre comillas.
//  Para las listas, la página escoge uno al azar cada vez.
// ─────────────────────────────────────────────────────────────

export const nombre = 'Claudia';

// Saludo de arriba según la hora del día.
export const saludos = {
  manana: 'Buenos días, Claudia',
  tarde: 'Buenas tardes, Claudia',
  noche: 'Buenas noches, Claudia',
};

// Cuando Ferrari hizo podio en la última carrera.
export const ferrariPodio = [
  { titulo: '¡Forza Ferrari! 🏆', texto: 'Podio rojo el fin de semana. Seguro lo celebraste como si fuera tuyo, y un poco sí lo es.' },
  { titulo: 'Eso es Maranello', texto: 'Ferrari al podio. Hoy te toca presumir con todo el que diga que no iban a poder.' },
];

// Cuando Ferrari sumó puntos pero no hizo podio.
export const ferrariPuntos = [
  { titulo: 'Puntos para la Scuderia', texto: 'No fue podio, pero suman. Cada punto cuenta, y tú lo sabes mejor que nadie.' },
  { titulo: 'Ahí van', texto: 'Ferrari sumó. No fue perfecto, pero la próxima puede ser la buena.' },
];

// Cuando a Ferrari le fue mal.
export const ferrariMal = [
  { titulo: 'Fin de semana difícil', texto: 'No salió como queríamos. Pero los tifosi no se rinden, y tú tampoco.' },
  { titulo: 'Ya vendrán mejores', texto: 'Hay carreras así. Lo bueno es que la próxima ya está en el calendario.' },
];

// Nota escondida: aparece al tocar 5 veces el cuadrito rojo de arriba.
export const notaEscondida = {
  titulo: 'Para ti 🤍',
  parrafos: [
    'Sé que estos días no son los más fáciles, así que quise hacerte algo que pudieras usar cuando quieras, no solo mirar una vez.',
    'Aquí vas a tener todo lo de la F1 a la mano: cuándo es la próxima carrera, cómo va el campeonato y cada circuito en 3D.',
    'Descansa, consiéntete un poquito y, si Ferrari te hace sufrir el domingo, ya sabes que aquí estoy para quejarnos juntos.',
  ],
  firma: '— Daniel',
};

// Pista pequeña al final de la página para que sepa que hay algo escondido.
// Déjalo vacío ('') si prefieres decírselo tú.
export const pistaNota = 'Psst: el cuadrito rojo de arriba guarda algo si insistes.';
