import { validate } from '../src/validator';
import type { Issue } from '../src/validator';

export function validateResource(resource: Record<string, unknown>): Issue[] {
  return validate(JSON.stringify(resource, null, 2));
}

export function errorsIn(resource: Record<string, unknown>): Issue[] {
  return validateResource(resource).filter((issue) => issue.severity === 'error');
}
