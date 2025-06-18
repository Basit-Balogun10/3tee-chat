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
import type * as ai from "../ai.js";
import type * as aiHelpers from "../aiHelpers.js";
import type * as anonymous from "../anonymous.js";
import type * as artifacts from "../artifacts.js";
import type * as auth from "../auth.js";
import type * as chats from "../chats.js";
import type * as emailAuth from "../emailAuth.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as preferences from "../preferences.js";
import type * as projects from "../projects.js";
import type * as router from "../router.js";
import type * as sharing from "../sharing.js";
import type * as streaming from "../streaming.js";
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
  ai: typeof ai;
  aiHelpers: typeof aiHelpers;
  anonymous: typeof anonymous;
  artifacts: typeof artifacts;
  auth: typeof auth;
  chats: typeof chats;
  emailAuth: typeof emailAuth;
  http: typeof http;
  messages: typeof messages;
  preferences: typeof preferences;
  projects: typeof projects;
  router: typeof router;
  sharing: typeof sharing;
  streaming: typeof streaming;
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
