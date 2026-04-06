"use client";

import { PostComposeExperience } from "./post-compose-experience";

type WriteScreenProps = {
  dataSourceMode: "supabase" | "mock";
};

export function WriteScreen({ dataSourceMode }: WriteScreenProps) {
  return <PostComposeExperience dataSourceMode={dataSourceMode} />;
}
