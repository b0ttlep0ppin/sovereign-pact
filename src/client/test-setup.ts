import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library can't register its own cleanup.
afterEach(cleanup);
// Tests that run in node (tools/) have no localStorage.
afterEach(() => globalThis.localStorage?.clear());
