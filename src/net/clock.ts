/**
 * Hora compartida de la sala. Los relojes de dos teléfonos pueden diferir varios segundos;
 * el invitado guarda la diferencia con el anfitrión para que la cuenta regresiva sea la misma.
 */
export const clock = { offset: 0 };
export const now = () => Date.now() + clock.offset;
