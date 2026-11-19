-- =====================================================================
-- Las preguntas "tiempo en la empresa" y "rol en la empresa" pasan a ser
-- opcionales (F37, R90). Reemplaza la decisión por defecto de F34.
-- Sigue valiendo el mínimo de respuestas de la configuración (min_answers).
-- Las funciones has_enough_answers y save_my_answers ya leen is_fixed, así
-- que no hace falta cambiarlas.
-- Se aplica pegándola en el SQL Editor de Supabase.
-- =====================================================================

update public.questions set is_fixed = false where id in (1, 2);
