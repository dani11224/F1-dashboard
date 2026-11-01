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
  tarde: 'Hola, ¿cómo estuvo tu día hoy?',
  noche: 'Buenas noches, ¿cómo te fue hoy?',
};

// Cuando Ferrari hizo podio en la última carrera.
export const ferrariPodio = [
  { titulo: 'Podio para Ferrari', texto: 'Seguro estabas feliz viendo eso.' },
  { titulo: 'Buen fin de semana', texto: 'Ferrari al podio. Qué bueno.' },
];

// Cuando Ferrari sumó puntos pero no hizo podio.
export const ferrariPuntos = [
  { titulo: 'Sumaron puntos', texto: 'No fue podio, pero algo es algo.' },
  { titulo: 'Nada mal', texto: 'Ferrari sumó. La próxima puede ser mejor.' },
];

// Cuando a Ferrari le fue mal.
export const ferrariMal = [
  { titulo: 'No fue su fin de semana', texto: 'Ya vendrá una mejor.' },
  { titulo: 'Fin de semana difícil', texto: 'Hay carreras así. La próxima ya está cerca.' },
];

// Nota escondida: aparece al tocar 5 veces el cuadrito rojo de arriba.
export const notaEscondida = {
  titulo: 'Para ti',
  parrafos: [
    'Espero que te sientas mejor.',
    'Te hice esto para que tengas todo lo de la F1 en un solo lugar.',
    'Descansa y cuídate.',
    'Y aunque no tenga ni la menor idea de lo que pasa en la F1, me quejo contigo.',
  ],
  firma: 'Daniel',
};

// Pista pequeña al final de la página para que sepa que hay algo escondido.
// Déjalo vacío ('') si prefieres decírselo tú.
export const pistaNota = 'El cuadrito rojo de arriba guarda algo.';
