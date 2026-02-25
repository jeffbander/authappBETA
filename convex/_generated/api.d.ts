/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cleanup from "../cleanup.js";
import type * as feedback from "../feedback.js";
import type * as patients from "../patients.js";
import type * as processing from "../processing.js";
import type * as providers from "../providers.js";
import type * as reviews from "../reviews.js";
import type * as rules from "../rules.js";
import type * as smsSurveys from "../smsSurveys.js";
import type * as surveyHelpers from "../surveyHelpers.js";
import type * as training from "../training.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cleanup: typeof cleanup;
  feedback: typeof feedback;
  patients: typeof patients;
  processing: typeof processing;
  providers: typeof providers;
  reviews: typeof reviews;
  rules: typeof rules;
  smsSurveys: typeof smsSurveys;
  surveyHelpers: typeof surveyHelpers;
  training: typeof training;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
