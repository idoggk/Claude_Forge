import type { ComponentType } from 'react';
import type { Lesson, WidgetId } from '@/domain/curriculum/types';
import { CapstoneBrief, MechanismMap, ReviewBoard, SkillAutopsyFiles, SkillMdAnatomy, TriggerDojoWidget, WorkshopLink } from './basic';
import { EconomyLab, ExperimentDemo, MergeLab } from './heavy';

export const WIDGETS: Record<WidgetId, ComponentType<{ lesson: Lesson }>> = {
  'mechanism-map': MechanismMap,
  'skill-md-anatomy': SkillMdAnatomy,
  'trigger-dojo': TriggerDojoWidget,
  'skill-autopsy-files': SkillAutopsyFiles,
  'workshop-link': WorkshopLink,
  'merge-lab': MergeLab,
  'economy-lab': EconomyLab,
  'experiment-demo': ExperimentDemo,
  'review-board': ReviewBoard,
  'capstone-brief': CapstoneBrief,
};
