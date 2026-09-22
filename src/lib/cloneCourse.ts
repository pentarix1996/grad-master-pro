import type { Course } from '../types';

export const cloneCourse = (course: Course, name: string): Course => {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('El nombre del curso no puede estar vacío.');

  // Nested IDs are scoped to the course. Keep them so grades, overrides and
  // dismissed warnings retain their references, but copy every nested value.
  return {
    ...structuredClone(course),
    id: crypto.randomUUID(),
    name: trimmedName,
  };
};
