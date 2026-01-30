/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { ApiFromModules } from "convex/server";
import type * as patients from "../patients.js";
import type * as processing from "../processing.js";
import type * as providers from "../providers.js";
import type * as rules from "../rules.js";

/**
 * A utility for referencing Convex functions in your app's API.
 */
declare const fullApi: ApiFromModules<{
  patients: typeof patients;
  processing: typeof processing;
  providers: typeof providers;
  rules: typeof rules;
}>;
export declare const api: typeof fullApi;
export declare const internal: any;
