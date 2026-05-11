/**
 * Thin module: re-exports dwell helpers colocated with selection in ROP docs.
 * Implementation lives in `selection.ts` to avoid circular deps.
 */
export { dwellComplete, dwellProgress } from "./selection";
