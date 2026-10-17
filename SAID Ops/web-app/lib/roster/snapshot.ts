import type { ScheduledWork, PublishedScheduledWork } from './types';
export function cloneWork(item: ScheduledWork | PublishedScheduledWork): ScheduledWork {
  const { requiredSkills, requirements, ...work } = item;
  return { ...work, staffIds: [...item.staffIds],
    ...(requiredSkills ? { requiredSkills: [...requiredSkills] } : {}),
    ...(requirements ? { requirements: [...requirements] } : {}) };
}
