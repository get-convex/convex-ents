import { api } from "@/convex/_generated/api";
import { ConvexClient } from "convex/browser";

async () => {
  const foo = await new ConvexClient("").query(api.myFunctions.messages, {});
};
