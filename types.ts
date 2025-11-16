
export enum ValidationStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PARTIAL = 'PARTIAL',
}

export interface ValidationDetail {
  id: number;
  requirement: string;
  dianRule: string;
  status: ValidationStatus;
  reason: string;
  suggestion: string;
}

export interface ValidationResult {
  overallStatus: 'COMPLIANT' | 'NON_COMPLIANT';
  summary: string;
  details: ValidationDetail[];
}

export type AppState = 'idle' | 'loading' | 'results' | 'error';
