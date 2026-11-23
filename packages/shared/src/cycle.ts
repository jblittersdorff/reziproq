import { z } from 'zod';

export const cycleScheduleSteps = [
  'feedback',
  'touchpoints',
  'supplierPlan',
  'jbp',
  'scorecard',
] as const;
export type CycleScheduleStep = (typeof cycleScheduleSteps)[number];

export const cycleSettingSchema = z.object({
  step: z.enum(cycleScheduleSteps),
  weeksRelativeToJbp: z.number().int().min(-104).max(104),
  reminderDaysBefore: z.number().int().min(0).max(365),
});

export const cycleDeadlineSchema = cycleSettingSchema.extend({
  dueDate: z.iso.date().nullable(),
});

export const cycleSettingsSchema = z
  .array(cycleSettingSchema)
  .length(cycleScheduleSteps.length)
  .superRefine((settings, context) => {
    const steps = new Set(settings.map(({ step }) => step));
    if (steps.size !== cycleScheduleSteps.length) {
      context.addIssue({
        code: 'custom',
        message: 'Jeder Zyklusschritt muss genau einmal vorkommen.',
      });
    }
  });

export const cycleSettingsResponseSchema = z.object({ settings: cycleSettingsSchema });
export const updateCycleSettingsSchema = cycleSettingsResponseSchema;

export const setJbpDateSchema = z.object({ jbpDate: z.iso.date() });

export type CycleSetting = z.infer<typeof cycleSettingSchema>;
export type UpdateCycleSettings = z.infer<typeof updateCycleSettingsSchema>;

export const defaultCycleSettings: CycleSetting[] = [
  { step: 'feedback', weeksRelativeToJbp: -8, reminderDaysBefore: 7 },
  { step: 'touchpoints', weeksRelativeToJbp: -6, reminderDaysBefore: 7 },
  { step: 'supplierPlan', weeksRelativeToJbp: -2, reminderDaysBefore: 7 },
  { step: 'jbp', weeksRelativeToJbp: 0, reminderDaysBefore: 7 },
  { step: 'scorecard', weeksRelativeToJbp: 3, reminderDaysBefore: 7 },
];

export function offsetCycleDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days))
    .toISOString()
    .slice(0, 10);
}

export function calculateCycleDueDate(jbpDate: string, weeksRelativeToJbp: number): string {
  return offsetCycleDate(jbpDate, weeksRelativeToJbp * 7);
}

export function calculateCycleDeadlines(
  jbpDate: string | null,
  settings: CycleSetting[],
): z.infer<typeof cycleDeadlineSchema>[] {
  return settings.map(({ step, weeksRelativeToJbp, reminderDaysBefore }) => ({
    step,
    weeksRelativeToJbp,
    reminderDaysBefore,
    dueDate: jbpDate ? calculateCycleDueDate(jbpDate, weeksRelativeToJbp) : null,
  }));
}
