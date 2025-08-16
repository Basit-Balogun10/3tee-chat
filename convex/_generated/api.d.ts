/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai_config from "../ai/config.js";
import type * as ai_generation from "../ai/generation.js";
import type * as ai_helpers from "../ai/helpers.js";
import type * as ai_providers from "../ai/providers.js";
import type * as ai from "../ai.js";
import type * as aiHelpers from "../aiHelpers.js";
import type * as aiSdkHelpers from "../aiSdkHelpers.js";
import type * as analytics from "../analytics.js";
import type * as artifacts from "../artifacts.js";
import type * as auth from "../auth.js";
import type * as branches from "../branches.js";
import type * as chats from "../chats.js";
import type * as cleanup from "../cleanup.js";
import type * as crons from "../crons.js";
import type * as emailAuth from "../emailAuth.js";
import type * as geminiActions from "../geminiActions.js";
import type * as http from "../http.js";
import type * as library from "../library.js";
import type * as messages from "../messages.js";
import type * as preferences from "../preferences.js";
import type * as projects from "../projects.js";
import type * as router from "../router.js";
import type * as search from "../search.js";
import type * as sharing from "../sharing.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "ai/config": typeof ai_config;
  "ai/generation": typeof ai_generation;
  "ai/helpers": typeof ai_helpers;
  "ai/providers": typeof ai_providers;
  ai: typeof ai;
  aiHelpers: typeof aiHelpers;
  aiSdkHelpers: typeof aiSdkHelpers;
  analytics: typeof analytics;
  artifacts: typeof artifacts;
  auth: typeof auth;
  branches: typeof branches;
  chats: typeof chats;
  cleanup: typeof cleanup;
  crons: typeof crons;
  emailAuth: typeof emailAuth;
  geminiActions: typeof geminiActions;
  http: typeof http;
  library: typeof library;
  messages: typeof messages;
  preferences: typeof preferences;
  projects: typeof projects;
  router: typeof router;
  search: typeof search;
  sharing: typeof sharing;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
