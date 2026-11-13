// §6.15 Dropped items. Not implemented yet: a Phase 2 task replaces this body (DESIGN.md §12).
// Registered in score.ts already, so implementing the rule means editing only this file.
import type { RoomContext, Line, RoomRule } from '../types.ts';

export const droppedRule: RoomRule = (_context: RoomContext): Line[] => [];
