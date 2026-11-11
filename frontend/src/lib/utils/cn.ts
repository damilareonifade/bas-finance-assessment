import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...classValues: ClassValue[]): string {
  return twMerge(clsx(classValues));
}
