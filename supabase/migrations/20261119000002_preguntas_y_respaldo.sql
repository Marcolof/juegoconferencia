-- =====================================================================
-- Preguntas por defecto y listado de respaldo (R53, R69, R72)
-- Las preguntas 1 y 2 son fijas (F29). La 3 y la 4 son la propuesta
-- vigente (P69) y se pueden cambiar con otra migración.
-- Los listados de respaldo de las preguntas 1 y 2 son una propuesta.
-- =====================================================================

insert into public.questions (id, position, text, is_fixed) values
  (1, 1, '¿Cuánto tiempo hace que trabajás en Vortex?', true),
  (2, 2, '¿Cuál es tu rol en la empresa?', true),
  (3, 3, '¿Qué superpoder elegirías?', false),
  (4, 4, '¿Cuál es tu lugar ideal para unas vacaciones?', false);

insert into public.fallback_answers (question_id, text) values
  (1, 'Menos de 6 meses'), (1, '1 año'), (1, '2 años'), (1, '3 años'),
  (1, '4 años'), (1, '5 años'), (1, '7 años'), (1, 'Más de 10 años'),

  (2, 'Diseño'), (2, 'Desarrollo'), (2, 'Ventas'), (2, 'Marketing'),
  (2, 'Recursos humanos'), (2, 'Finanzas'), (2, 'Soporte'), (2, 'Gerencia'),
  (2, 'Calidad (QA)'), (2, 'Producto'), (2, 'Administración'), (2, 'Operaciones'),

  (3, 'Volar'), (3, 'Ser invisible'), (3, 'Teletransportarme'), (3, 'Leer mentes'),
  (3, 'Viajar en el tiempo'), (3, 'Superfuerza'), (3, 'Hablar todos los idiomas'),
  (3, 'Controlar el clima'), (3, 'Respirar bajo el agua'), (3, 'Detener el tiempo'),
  (3, 'Curar a otros'), (3, 'Volverme gigante'),

  (4, 'Playa'), (4, 'Montaña'), (4, 'Una gran ciudad'), (4, 'Campo'), (4, 'Nieve'),
  (4, 'Crucero'), (4, 'Desierto'), (4, 'Selva'), (4, 'Isla tropical'), (4, 'Lago'),
  (4, 'Pueblo chico'), (4, 'Quedarme en casa');
